// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ITripAccount } from "./interfaces/ITripAccount.sol";
import { IFlowSettlement } from "./interfaces/IFlowSettlement.sol";
import { FlowTypes } from "./interfaces/Types.sol";

/// @title TripAccount
/// @notice Per-trip smart account for a tourist. Deployed as an EIP-1167 clone
///         by TripAccountFactory. Enforces budget / per-tx / agent limits and
///         forwards payments to FlowSettlement.
contract TripAccount is ITripAccount {
    using SafeERC20 for IERC20;

    bytes32 private constant _EIP712_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant _PAY_TYPEHASH = keccak256(
        "Pay(bytes32 quoteHash,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant _QUOTE_TYPEHASH = keccak256(
        "Quote(bytes32 orderRef,bytes32 merchantId,address payer,uint256 fiatAmount,bytes3 currency,uint256 usdcAmount,uint64 expiresAt)"
    );
    bytes32 private constant _NAME_HASH = keccak256("FlowPay-TripAccount");
    bytes32 private constant _VERSION_HASH = keccak256("1");

    address private _owner;
    address private _agent;
    address private _usdc;
    address private _settlement;
    uint256 private _tripBudget;
    uint256 private _spent;
    uint256 private _perTxCap;
    uint256 private _agentPerTxCap;
    uint64 private _expiresAt;
    uint256 private _nonce;
    bool private _initialized;

    function initialize(
        address owner_,
        address usdc_,
        address settlement_,
        uint256 tripBudget_,
        uint256 perTxCap_,
        uint64 expiresAt_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (owner_ == address(0) || usdc_ == address(0) || settlement_ == address(0)) revert ZeroAddress();
        _initialized = true;
        _owner = owner_;
        _usdc = usdc_;
        _settlement = settlement_;
        _tripBudget = tripBudget_;
        _perTxCap = perTxCap_;
        _expiresAt = expiresAt_;
        emit Initialized(owner_, usdc_, settlement_, tripBudget_, perTxCap_, expiresAt_);
    }

    modifier onlyOwner_() {
        if (msg.sender != _owner) revert NotOwner();
        _;
    }

    function owner() external view returns (address) { return _owner; }
    function agent() external view returns (address) { return _agent; }
    function usdc() external view returns (address) { return _usdc; }
    function settlement() external view returns (address) { return _settlement; }
    function tripBudget() external view returns (uint256) { return _tripBudget; }
    function spent() external view returns (uint256) { return _spent; }
    function perTxCap() external view returns (uint256) { return _perTxCap; }
    function agentPerTxCap() external view returns (uint256) { return _agentPerTxCap; }
    function expiresAt() external view returns (uint64) { return _expiresAt; }
    function nonce() external view returns (uint256) { return _nonce; }
    function remainingBudget() external view returns (uint256) {
        return _tripBudget > _spent ? _tripBudget - _spent : 0;
    }
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator();
    }

    function setLimits(uint256 tripBudget_, uint256 perTxCap_, uint64 expiresAt_) external onlyOwner_ {
        _tripBudget = tripBudget_;
        _perTxCap = perTxCap_;
        _expiresAt = expiresAt_;
        if (_agentPerTxCap > perTxCap_) _agentPerTxCap = perTxCap_;
        emit LimitsSet(tripBudget_, perTxCap_, expiresAt_);
    }

    function setAgent(address agent_, uint256 agentPerTxCap_) external onlyOwner_ {
        if (agentPerTxCap_ > _perTxCap) revert AgentCapAboveOwnerCap();
        _agent = agent_;
        _agentPerTxCap = agentPerTxCap_;
        emit AgentSet(agent_, agentPerTxCap_);
    }

    function revokeAgent() external onlyOwner_ {
        address prev = _agent;
        _agent = address(0);
        _agentPerTxCap = 0;
        emit AgentRevoked(prev);
    }

    function withdraw(address to, uint256 amount) external onlyOwner_ {
        if (to == address(0)) revert ZeroAddress();
        IERC20(_usdc).safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    function pay(FlowTypes.Quote calldata q, bytes calldata quoteSig)
        external
        returns (bytes32 orderId)
    {
        bool isAgent = (msg.sender == _agent && _agent != address(0));
        if (msg.sender != _owner && !isAgent) revert NotAuthorized();
        _checkLimits(q.usdcAmount, isAgent);
        orderId = _executePay(q, quoteSig, isAgent);
    }

    function payWithSig(
        FlowTypes.Quote calldata q,
        bytes calldata quoteSig,
        uint256 deadline,
        bytes calldata ownerSig
    ) external returns (bytes32 orderId) {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 quoteHash = _hashQuote(q);
        bytes32 structHash = keccak256(abi.encode(_PAY_TYPEHASH, quoteHash, _nonce, deadline));
        bytes32 digest = _hashTypedData(structHash);
        address signer = ECDSA.recover(digest, ownerSig);
        if (signer != _owner) revert InvalidSignature();
        unchecked { ++_nonce; }
        _checkLimits(q.usdcAmount, false);
        orderId = _executePay(q, quoteSig, false);
    }

    function _executePay(FlowTypes.Quote calldata q, bytes calldata quoteSig, bool byAgent)
        internal
        returns (bytes32 orderId)
    {
        _spent += q.usdcAmount;
        IERC20(_usdc).forceApprove(_settlement, q.usdcAmount);
        orderId = IFlowSettlement(_settlement).createOrder(q, quoteSig);
        emit PaymentAuthorized(orderId, q.usdcAmount, byAgent);
    }

    function _checkLimits(uint256 amount, bool isAgent) internal view {
        if (block.timestamp > _expiresAt) revert TripExpired();
        if (amount > _perTxCap) revert PerTxCapExceeded();
        if (isAgent && amount > _agentPerTxCap) revert AgentCapExceeded();
        if (_spent + amount > _tripBudget) revert BudgetExceeded();
    }

    function _hashQuote(FlowTypes.Quote calldata q) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            _QUOTE_TYPEHASH,
            q.orderRef,
            q.merchantId,
            q.payer,
            q.fiatAmount,
            q.currency,
            q.usdcAmount,
            q.expiresAt
        ));
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(
            _EIP712_TYPEHASH,
            _NAME_HASH,
            _VERSION_HASH,
            block.chainid,
            address(this)
        ));
    }
}
