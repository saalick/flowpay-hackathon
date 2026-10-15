// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FlowPay shared types
/// @notice Structs and enums used across TripAccount, FlowSettlement, and friends.
library FlowTypes {
    /// @notice EIP-712 signed quote. Signed by the server's quote signer key.
    /// @dev    `payer` binds the quote to one TripAccount — a quote cannot be
    ///         replayed from a different sender. `orderRef` is the server-chosen
    ///         nonce; the on-chain orderId is derived from it (see FlowSettlement).
    struct Quote {
        bytes32 orderRef;      // server-generated nonce, unique per order
        bytes32 merchantId;    // keccak256 handle for the merchant
        address payer;         // must equal msg.sender in createOrder (the TripAccount)
        uint256 fiatAmount;    // minor units; 450.00 THB = 45_000 satang
        bytes3  currency;      // ISO 4217 ASCII, e.g. "THB"
        uint256 usdcAmount;    // 6 decimals (Circle USDC)
        uint64  expiresAt;     // short, ~60s from issue
    }

    /// @notice Lifecycle for a single order inside FlowSettlement.
    enum OrderStatus {
        None,
        Open,          // waiting for an LP within p2pWindow
        LPAccepted,    // LP accepted; has lpPayWindow to send fiat
        LPPaid,        // LP claims fiat sent; awaiting merchant confirmation
        Settled,       // confirmReceived fired, LP got USDC minus fee
        RoutedOfframp, // dispatched to an allowlisted offramp destination
        RoutedFloat,   // dispatched to the baht float (treasury)
        Refunded       // returned to the original payer (TripAccount)
    }

    /// @notice Which rail actually settled an order. Emitted for audit/analytics.
    enum Route {
        None,
        P2P,
        Offramp,
        Float
    }
}
