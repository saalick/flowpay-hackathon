// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FlowTypes } from "./Types.sol";

/// @title TripAccount — tourist's trip-scoped smart account
/// @notice One clone per tourist trip. Holds USDC. Enforces spending limits
///         and an optional AI session key (`agent`) that can pay on the user's
///         behalf up to a tighter cap.
/// @dev    Deployed as an EIP-1167 minimal proxy by TripAccountFactory and
///         initialised exactly once. Approves and calls FlowSettlement.createOrder
///         on behalf of the tourist.
interface ITripAccount {
    // --- errors ---
    error NotOwner();
    error NotAuthorized();          // caller is neither owner nor agent
    error TripExpired();
    error BudgetExceeded();
    error PerTxCapExceeded();
    error AgentCapExceeded();
    error AgentCapAboveOwnerCap();  // agent cap must not exceed per-tx cap
    error InvalidSignature();
    error SignatureExpired();
    error AlreadyInitialized();
    error ZeroAddress();

    // --- events ---
    event Initialized(
        address indexed owner,
        address indexed usdc,
        address indexed settlement,
        uint256 tripBudget,
        uint256 perTxCap,
        uint64 expiresAt
    );
    event LimitsSet(uint256 tripBudget, uint256 perTxCap, uint64 expiresAt);
    event AgentSet(address indexed agent, uint256 agentPerTxCap);
    event AgentRevoked(address indexed agent);
    event PaymentAuthorized(bytes32 indexed orderId, uint256 usdcAmount, bool byAgent);
    event Withdrawn(address indexed to, uint256 amount);

    // --- views ---
    function owner() external view returns (address);
    function agent() external view returns (address);
    function usdc() external view returns (address);
    function settlement() external view returns (address);
    function tripBudget() external view returns (uint256);
    function spent() external view returns (uint256);
    function perTxCap() external view returns (uint256);
    function agentPerTxCap() external view returns (uint256);
    function expiresAt() external view returns (uint64);
    function remainingBudget() external view returns (uint256);
    function nonce() external view returns (uint256); // replay protection for payWithSig

    // --- lifecycle (factory only, called immediately after clone) ---
    function initialize(
        address owner_,
        address usdc_,
        address settlement_,
        uint256 tripBudget_,
        uint256 perTxCap_,
        uint64 expiresAt_
    ) external;

    // --- owner-only configuration ---
    function setLimits(uint256 tripBudget_, uint256 perTxCap_, uint64 expiresAt_) external;
    function setAgent(address agent_, uint256 agentPerTxCap_) external;
    function revokeAgent() external;
    function withdraw(address to, uint256 amount) external;

    // --- payment entry points ---

    /// @notice Pay a merchant through FlowSettlement. Caller must be owner or agent.
    /// @dev    Validates limits (not expired, perTxCap, agentPerTxCap if agent, tripBudget),
    ///         increments `spent`, approves USDC to FlowSettlement, and calls createOrder.
    function pay(FlowTypes.Quote calldata q, bytes calldata quoteSig)
        external
        returns (bytes32 orderId);

    /// @notice Gasless variant. A relayer submits; the owner's EIP-712 signature authorizes.
    /// @dev    Signature covers (quote hash, nonce, deadline, chainId, this address).
    function payWithSig(
        FlowTypes.Quote calldata q,
        bytes calldata quoteSig,
        uint256 deadline,
        bytes calldata ownerSig
    ) external returns (bytes32 orderId);
}
