// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IFlowSettlement } from "./interfaces/IFlowSettlement.sol";
import { ILPRegistry } from "./interfaces/ILPRegistry.sol";
import { FlowTypes } from "./interfaces/Types.sol";

/// @title FlowSettlement
/// @notice Pulls USDC from a TripAccount, holds it in escrow, routes it to
///         one of four destinations: assigned LP (P2P), allowlisted offramp,
///         treasury (float), or back to the payer (refund). No other exits.
contract FlowSettlement is IFlowSettlement, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error LpRegistryAlreadySet();

    bytes32 public constant ORCHESTRATOR_ROLE = keccak256("ORCHESTRATOR_ROLE");
    bytes32 public constant CONFIRMER_ROLE = keccak256("CONFIRMER_ROLE");

    bytes32 private constant _EIP712_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant _QUOTE_TYPEHASH = keccak256(
        "Quote(bytes32 orderRef,bytes32 merchantId,address payer,uint256 fiatAmount,bytes3 currency,uint256 usdcAmount,uint64 expiresAt)"
    );
    bytes32 private constant _NAME_HASH = keccak256("FlowPay-Settlement");
    bytes32 private constant _VERSION_HASH = keccak256("1");

    IERC20 public immutable usdcToken;

    address public lpRegistryAddr;
    bool private _lpRegistryInit;

    address public treasuryAddr;
    address public quoteSignerAddr;
    uint32 public p2pWindowSeconds;
    uint32 public lpPayWindowSeconds;
    uint32 public refundTimeoutSeconds;
    uint16 public protocolFeeBpsVal;

    struct Order {
        bytes32 merchantId;
        address payer;
        uint256 fiatAmount;
        bytes3 currency;
        uint256 usdcAmount;
        uint64 createdAt;
        uint64 openUntil;
        uint64 payDeadline;
        address assignedLP;
        FlowTypes.OrderStatus status;
    }

    struct Offramp {
        address destination;
        bool allowed;
    }

    mapping(bytes32 => Order) private _orders;
    mapping(bytes32 => address) private _merchants;
    mapping(bytes32 => Offramp) private _offramps;

    constructor(
        address usdc_,
        address treasury_,
        address quoteSigner_,
        address admin_,
        address orchestrator_,
        address confirmer_
    ) {
        if (
            usdc_ == address(0) ||
            treasury_ == address(0) ||
            admin_ == address(0) ||
            quoteSigner_ == address(0)
        ) revert ZeroAddress();
        usdcToken = IERC20(usdc_);
        treasuryAddr = treasury_;
        quoteSignerAddr = quoteSigner_;
        p2pWindowSeconds = 10;
        lpPayWindowSeconds = 120;
        refundTimeoutSeconds = 3600;
        protocolFeeBpsVal = 50;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(ORCHESTRATOR_ROLE, orchestrator_);
        _grantRole(CONFIRMER_ROLE, confirmer_);
    }

    function setLpRegistry(address lpRegistry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_lpRegistryInit) revert LpRegistryAlreadySet();
        if (lpRegistry_ == address(0)) revert ZeroAddress();
        lpRegistryAddr = lpRegistry_;
        _lpRegistryInit = true;
    }

    function usdc() external view returns (address) { return address(usdcToken); }
    function lpRegistry() external view returns (address) { return lpRegistryAddr; }
    function treasury() external view returns (address) { return treasuryAddr; }
    function p2pWindow() external view returns (uint32) { return p2pWindowSeconds; }
    function lpPayWindow() external view returns (uint32) { return lpPayWindowSeconds; }
    function refundTimeout() external view returns (uint32) { return refundTimeoutSeconds; }
    function protocolFeeBps() external view returns (uint16) { return protocolFeeBpsVal; }
    function quoteSigner() external view returns (address) { return quoteSignerAddr; }
    function offrampDestination(bytes32 offrampId) external view returns (address, bool) {
        Offramp memory o = _offramps[offrampId];
        return (o.destination, o.allowed);
    }
    function merchantAddress(bytes32 merchantId) external view returns (address) {
        return _merchants[merchantId];
    }
    function orderStatus(bytes32 orderId) external view returns (FlowTypes.OrderStatus) {
        return _orders[orderId].status;
    }
    function orderAssignedLP(bytes32 orderId) external view returns (address) {
        return _orders[orderId].assignedLP;
    }
    function orderOpenUntil(bytes32 orderId) external view returns (uint64) {
        return _orders[orderId].openUntil;
    }
    function orderPayDeadline(bytes32 orderId) external view returns (uint64) {
        return _orders[orderId].payDeadline;
    }
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator();
    }

    function setQuoteSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (signer == address(0)) revert ZeroAddress();
        quoteSignerAddr = signer;
        emit QuoteSignerSet(signer);
    }

    function setWindows(uint32 p2p, uint32 lpPay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (p2p == 0 || lpPay == 0) revert BadWindow();
        p2pWindowSeconds = p2p;
        lpPayWindowSeconds = lpPay;
        emit WindowsSet(p2p, lpPay);
    }

    function setProtocolFee(uint16 bps, address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > 10_000) revert BadFeeBps();
        if (treasury_ == address(0)) revert ZeroAddress();
        protocolFeeBpsVal = bps;
        treasuryAddr = treasury_;
        emit ProtocolFeeSet(bps, treasury_);
    }

    function setOfframp(bytes32 offrampId, address destination, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _offramps[offrampId] = Offramp({ destination: destination, allowed: allowed });
        emit OfframpSet(offrampId, destination, allowed);
    }

    function registerMerchant(bytes32 merchantId, address merchantAddr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (merchantAddr == address(0)) revert ZeroAddress();
        _merchants[merchantId] = merchantAddr;
        emit MerchantRegistered(merchantId, merchantAddr);
    }

    function setRefundTimeout(uint32 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        refundTimeoutSeconds = seconds_;
        emit RefundTimeoutSet(seconds_);
    }

    function createOrder(FlowTypes.Quote calldata q, bytes calldata quoteSig)
        external
        nonReentrant
        returns (bytes32 orderId)
    {
        if (block.timestamp > q.expiresAt) revert QuoteExpired();
        if (msg.sender != q.payer) revert QuotePayerMismatch();
        if (_merchants[q.merchantId] == address(0)) revert MerchantNotRegistered();

        bytes32 digest = _hashTypedData(_hashQuote(q));
        address signer = ECDSA.recover(digest, quoteSig);
        if (signer != quoteSignerAddr) revert QuoteInvalidSigner();

        orderId = keccak256(abi.encode(q.orderRef, block.chainid, address(this)));
        if (_orders[orderId].status != FlowTypes.OrderStatus.None) revert OrderExists();

        uint64 openUntil_ = uint64(block.timestamp) + uint64(p2pWindowSeconds);

        _orders[orderId] = Order({
            merchantId: q.merchantId,
            payer: q.payer,
            fiatAmount: q.fiatAmount,
            currency: q.currency,
            usdcAmount: q.usdcAmount,
            createdAt: uint64(block.timestamp),
            openUntil: openUntil_,
            payDeadline: 0,
            assignedLP: address(0),
            status: FlowTypes.OrderStatus.Open
        });

        usdcToken.safeTransferFrom(msg.sender, address(this), q.usdcAmount);

        emit OrderCreated(
            orderId,
            q.merchantId,
            q.payer,
            q.fiatAmount,
            q.currency,
            q.usdcAmount,
            openUntil_
        );
    }

    function acceptOrder(bytes32 orderId) external {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.Open) revert OrderNotOpen();
        if (block.timestamp > o.openUntil) revert OpenWindowElapsed();

        ILPRegistry reg = ILPRegistry(lpRegistryAddr);
        if (!reg.registeredFor(o.currency, msg.sender)) revert LPCurrencyMismatch();
        if (reg.freeStake(msg.sender) < o.usdcAmount) revert LPInsufficientStake();

        reg.lockStake(msg.sender, o.usdcAmount, orderId);
        o.assignedLP = msg.sender;
        o.payDeadline = uint64(block.timestamp) + uint64(lpPayWindowSeconds);
        o.status = FlowTypes.OrderStatus.LPAccepted;

        emit OrderAccepted(orderId, msg.sender, o.payDeadline);
    }

    function markPaid(bytes32 orderId, string calldata paymentRef) external {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.LPAccepted) revert OrderNotAccepted();
        if (msg.sender != o.assignedLP) revert NotAssignedLP();
        if (block.timestamp > o.payDeadline) revert PayWindowElapsed();
        o.status = FlowTypes.OrderStatus.LPPaid;
        emit LPMarkedPaid(orderId, msg.sender, paymentRef);
    }

    function confirmReceived(bytes32 orderId) external nonReentrant {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.LPPaid) revert OrderNotPaid();
        if (msg.sender != _merchants[o.merchantId] && !hasRole(CONFIRMER_ROLE, msg.sender)) {
            revert NotMerchantOrConfirmer();
        }

        uint256 fee = (o.usdcAmount * protocolFeeBpsVal) / 10_000;
        uint256 net = o.usdcAmount - fee;
        address lp = o.assignedLP;
        uint256 amount = o.usdcAmount;

        o.status = FlowTypes.OrderStatus.Settled;

        ILPRegistry(lpRegistryAddr).unlockStake(lp, amount, orderId);
        if (fee > 0) usdcToken.safeTransfer(treasuryAddr, fee);
        usdcToken.safeTransfer(lp, net);

        emit OrderSettled(orderId, FlowTypes.Route.P2P, lp, net, fee);
    }

    function dispute(bytes32 orderId, string calldata reason) external nonReentrant {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.LPPaid) revert OrderNotPaid();
        if (msg.sender != _merchants[o.merchantId] && !hasRole(CONFIRMER_ROLE, msg.sender)) {
            revert NotMerchantOrConfirmer();
        }

        address lp = o.assignedLP;
        uint256 amount = o.usdcAmount;
        o.status = FlowTypes.OrderStatus.RoutedFloat;

        ILPRegistry(lpRegistryAddr).slash(lp, amount, treasuryAddr, orderId);
        usdcToken.safeTransfer(treasuryAddr, amount);

        emit OrderDisputed(orderId, msg.sender, reason);
        emit OrderRouted(orderId, FlowTypes.Route.Float, treasuryAddr);
    }

    function routeToOfframp(bytes32 orderId, bytes32 offrampId)
        external
        onlyRole(ORCHESTRATOR_ROLE)
        nonReentrant
    {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.Open) revert OrderNotOpen();
        if (block.timestamp <= o.openUntil) revert OpenWindowNotElapsed();
        Offramp memory off = _offramps[offrampId];
        if (!off.allowed || off.destination == address(0)) revert OfframpNotAllowed();

        o.status = FlowTypes.OrderStatus.RoutedOfframp;
        usdcToken.safeTransfer(off.destination, o.usdcAmount);

        emit OrderRouted(orderId, FlowTypes.Route.Offramp, off.destination);
    }

    function routeToFloat(bytes32 orderId) external onlyRole(ORCHESTRATOR_ROLE) nonReentrant {
        Order storage o = _orders[orderId];
        FlowTypes.OrderStatus s = o.status;

        if (s == FlowTypes.OrderStatus.Open) {
            if (block.timestamp <= o.openUntil) revert OpenWindowNotElapsed();
        } else if (s == FlowTypes.OrderStatus.LPAccepted) {
            if (block.timestamp <= o.payDeadline) revert PayWindowNotElapsed();
            ILPRegistry(lpRegistryAddr).slash(o.assignedLP, o.usdcAmount, treasuryAddr, orderId);
        } else {
            revert OrderNotOpen();
        }

        o.status = FlowTypes.OrderStatus.RoutedFloat;
        usdcToken.safeTransfer(treasuryAddr, o.usdcAmount);

        emit OrderRouted(orderId, FlowTypes.Route.Float, treasuryAddr);
    }

    function refund(bytes32 orderId) external onlyRole(ORCHESTRATOR_ROLE) nonReentrant {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.Open) revert OrderNotOpen();
        if (block.timestamp <= o.openUntil) revert OpenWindowNotElapsed();

        address payer = o.payer;
        o.status = FlowTypes.OrderStatus.Refunded;
        usdcToken.safeTransfer(payer, o.usdcAmount);

        emit OrderRefunded(orderId, payer);
    }

    function refundExpired(bytes32 orderId) external nonReentrant {
        Order storage o = _orders[orderId];
        if (o.status != FlowTypes.OrderStatus.Open) revert OrderNotOpen();
        if (block.timestamp < uint256(o.createdAt) + uint256(refundTimeoutSeconds)) revert RefundTooEarly();

        address payer = o.payer;
        o.status = FlowTypes.OrderStatus.Refunded;
        usdcToken.safeTransfer(payer, o.usdcAmount);

        emit OrderRefunded(orderId, payer);
    }

    function hashQuote(FlowTypes.Quote calldata q) external pure returns (bytes32) {
        return _hashQuote(q);
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
