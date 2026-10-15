// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FlowTypes } from "./Types.sol";

/// @title FlowSettlement — escrow + 3-route settlement router
/// @notice Pulls USDC from a TripAccount, holds it in escrow, and routes it to
///         one of: an accepting LP (P2P), an allowlisted offramp destination
///         (Offramp), the treasury float (Float), or back to the payer (Refund).
/// @dev    All funds that leave escrow go to one of those four roles. The
///         orchestrator cannot preempt an LP who accepted before the pay
///         deadline. Quotes are EIP-712 signed and single-use.
interface IFlowSettlement {
    // --- errors ---
    error QuoteExpired();
    error QuoteInvalidSigner();
    error QuotePayerMismatch();     // msg.sender != q.payer
    error OrderExists();            // orderRef replay
    error OrderMissing();
    error OrderNotOpen();
    error OrderNotAccepted();
    error OrderNotPaid();
    error OpenWindowNotElapsed();
    error OpenWindowElapsed();
    error PayWindowNotElapsed();
    error PayWindowElapsed();
    error NotAssignedLP();
    error LPCurrencyMismatch();
    error LPInsufficientStake();
    error MerchantNotRegistered();
    error OfframpNotAllowed();
    error NotMerchantOrConfirmer();
    error RefundTooEarly();
    error ZeroAddress();
    error BadFeeBps();              // > 10_000
    error BadWindow();              // zero windows disallowed

    // --- events ---
    event OrderCreated(
        bytes32 indexed orderId,
        bytes32 indexed merchantId,
        address indexed payer,
        uint256 fiatAmount,
        bytes3 currency,
        uint256 usdcAmount,
        uint64 openUntil
    );
    event OrderAccepted(bytes32 indexed orderId, address indexed lp, uint64 payDeadline);
    event LPMarkedPaid(bytes32 indexed orderId, address indexed lp, string paymentRef);
    event OrderSettled(
        bytes32 indexed orderId,
        FlowTypes.Route route,
        address indexed recipient,
        uint256 netAmount,
        uint256 fee
    );
    event OrderRouted(
        bytes32 indexed orderId,
        FlowTypes.Route route,
        address indexed destination
    );
    event OrderDisputed(bytes32 indexed orderId, address indexed by, string reason);
    event OrderRefunded(bytes32 indexed orderId, address indexed to);

    event OfframpSet(bytes32 indexed offrampId, address destination, bool allowed);
    event MerchantRegistered(bytes32 indexed merchantId, address indexed merchant);
    event QuoteSignerSet(address signer);
    event WindowsSet(uint32 p2pWindow, uint32 lpPayWindow);
    event ProtocolFeeSet(uint16 bps, address treasury);
    event RefundTimeoutSet(uint32 seconds_);

    // --- admin config (DEFAULT_ADMIN_ROLE) ---
    function setQuoteSigner(address signer) external;
    function setWindows(uint32 p2pWindow, uint32 lpPayWindow) external;
    function setProtocolFee(uint16 bps, address treasury) external;
    function setOfframp(bytes32 offrampId, address destination, bool allowed) external;
    function registerMerchant(bytes32 merchantId, address merchantAddress) external;
    function setRefundTimeout(uint32 seconds_) external;

    // --- order lifecycle ---

    /// @notice Pulls `q.usdcAmount` USDC from msg.sender (expected to be a
    ///         TripAccount that pre-approved this contract). Opens the order
    ///         for LP accept until `now + p2pWindow`.
    /// @dev    `orderId = keccak256(abi.encode(q.orderRef, block.chainid, address(this)))`.
    function createOrder(FlowTypes.Quote calldata q, bytes calldata quoteSig)
        external
        returns (bytes32 orderId);

    /// @notice An LP registered for `q.currency` with enough free stake accepts
    ///         the order while it's Open. Locks `usdcAmount` of the LP's stake
    ///         and sets `payDeadline = now + lpPayWindow`.
    function acceptOrder(bytes32 orderId) external;

    /// @notice Assigned LP records the off-chain fiat payment reference.
    ///         Moves order to LPPaid.
    function markPaid(bytes32 orderId, string calldata paymentRef) external;

    /// @notice Only in LPPaid: pays LP (usdcAmount - fee), fee to treasury,
    ///         unlocks stake. Caller must be merchant or hold CONFIRMER_ROLE.
    function confirmReceived(bytes32 orderId) external;

    /// @notice Only in LPPaid: slashes LP's locked stake to treasury and routes
    ///         the escrowed USDC to float. Caller must be merchant or CONFIRMER_ROLE.
    function dispute(bytes32 orderId, string calldata reason) external;

    // --- orchestrator-only routing (ORCHESTRATOR_ROLE) ---

    /// @notice Allowed only when Open and `now > openUntil` (no LP accepted in time).
    ///         Destination must be an allowlisted offramp.
    function routeToOfframp(bytes32 orderId, bytes32 offrampId) external;

    /// @notice Allowed when: Open and `now > openUntil`; OR LPAccepted and
    ///         `now > payDeadline` (in which case the LP's locked stake is
    ///         slashed to treasury first).
    function routeToFloat(bytes32 orderId) external;

    /// @notice Allowed when a route is unavailable (admin judgement). Returns
    ///         USDC to the payer. Order moves to Refunded.
    function refund(bytes32 orderId) external;

    // --- public safety valve ---

    /// @notice Anyone may call this once `refundTimeout` has elapsed since
    ///         order creation and no settlement has occurred. Returns USDC to
    ///         the payer. Covers the "orchestrator went offline" case.
    function refundExpired(bytes32 orderId) external;

    // --- views ---
    function usdc() external view returns (address);
    function lpRegistry() external view returns (address);
    function treasury() external view returns (address);
    function p2pWindow() external view returns (uint32);
    function lpPayWindow() external view returns (uint32);
    function refundTimeout() external view returns (uint32);
    function protocolFeeBps() external view returns (uint16);
    function quoteSigner() external view returns (address);
    function offrampDestination(bytes32 offrampId) external view returns (address destination, bool allowed);
    function merchantAddress(bytes32 merchantId) external view returns (address);
    function orderStatus(bytes32 orderId) external view returns (FlowTypes.OrderStatus);
    function orderAssignedLP(bytes32 orderId) external view returns (address);
    function orderOpenUntil(bytes32 orderId) external view returns (uint64);
    function orderPayDeadline(bytes32 orderId) external view returns (uint64);
}
