// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ITripAccountFactory } from "./interfaces/ITripAccountFactory.sol";
import { ITripAccount } from "./interfaces/ITripAccount.sol";

/// @title TripAccountFactory
/// @notice Deploys TripAccount clones (EIP-1167) at deterministic addresses.
contract TripAccountFactory is ITripAccountFactory {
    using Clones for address;

    address public immutable implementation;
    address public immutable settlement;
    address public immutable usdc;

    mapping(address => uint256) private _nonces;

    bytes32 private constant _EIP712_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant _CREATE_TYPEHASH = keccak256(
        "CreateTrip(address owner,uint256 tripBudget,uint256 perTxCap,uint64 expiresAt,bytes32 salt,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant _NAME_HASH = keccak256("FlowPay-TripFactory");
    bytes32 private constant _VERSION_HASH = keccak256("1");

    constructor(address implementation_, address settlement_, address usdc_) {
        if (implementation_ == address(0) || settlement_ == address(0) || usdc_ == address(0)) {
            revert ZeroAddress();
        }
        implementation = implementation_;
        settlement = settlement_;
        usdc = usdc_;
    }

    function nonces(address owner) external view returns (uint256) {
        return _nonces[owner];
    }

    function predict(address owner, bytes32 salt) public view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(owner, salt));
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparator();
    }

    function createTrip(
        address owner,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt,
        bytes32 salt
    ) public returns (address account) {
        if (owner == address(0)) revert ZeroAddress();
        account = Clones.cloneDeterministic(implementation, _salt(owner, salt));
        ITripAccount(account).initialize(owner, usdc, settlement, tripBudget, perTxCap, expiresAt);
        emit TripCreated(owner, account, tripBudget, perTxCap, expiresAt, salt);
    }

    function createTripWithSig(
        address owner,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt,
        bytes32 salt,
        uint256 deadline,
        bytes calldata ownerSig
    ) external returns (address account) {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash = keccak256(abi.encode(
            _CREATE_TYPEHASH,
            owner,
            tripBudget,
            perTxCap,
            expiresAt,
            salt,
            _nonces[owner],
            deadline
        ));
        bytes32 digest = _hashTypedData(structHash);
        address signer = ECDSA.recover(digest, ownerSig);
        if (signer != owner) revert InvalidSignature();
        unchecked { ++_nonces[owner]; }
        account = createTrip(owner, tripBudget, perTxCap, expiresAt, salt);
    }

    function _salt(address owner, bytes32 userSalt) internal pure returns (bytes32) {
        return keccak256(abi.encode(owner, userSalt));
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
