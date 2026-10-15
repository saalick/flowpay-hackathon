// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TripAccountFactory — deploys per-trip accounts as EIP-1167 clones
/// @notice One canonical implementation; each `(owner, salt)` deploys a
///         deterministic clone (CREATE2) so the server can predict addresses.
interface ITripAccountFactory {
    error InvalidImpl();
    error ZeroAddress();
    error SignatureExpired();
    error InvalidSignature();
    error TripAlreadyExists();

    event TripCreated(
        address indexed owner,
        address indexed account,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt,
        bytes32 salt
    );

    function implementation() external view returns (address);
    function settlement() external view returns (address);
    function usdc() external view returns (address);
    function nonces(address owner) external view returns (uint256);

    /// @notice Deterministic address for a given (owner, salt) pair; the clone
    ///         may or may not be deployed yet.
    function predict(address owner, bytes32 salt) external view returns (address);

    /// @notice Owner pays gas themselves.
    function createTrip(
        address owner,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt,
        bytes32 salt
    ) external returns (address account);

    /// @notice Gasless variant. Relayer calls; owner's EIP-712 signature authorizes.
    /// @dev    Signature covers (owner, tripBudget, perTxCap, expiresAt, salt,
    ///         nonce, deadline, chainId, this address).
    function createTripWithSig(
        address owner,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt,
        bytes32 salt,
        uint256 deadline,
        bytes calldata ownerSig
    ) external returns (address account);
}
