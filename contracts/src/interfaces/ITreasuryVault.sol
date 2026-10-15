// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TreasuryVault — holds USDC that funded float payouts
/// @notice In production this address would be a multisig. For the hackathon
///         it is a single admin EOA; the README calls this out explicitly.
interface ITreasuryVault {
    error ZeroAmount();
    error InsufficientBalance();

    event Received(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    function usdc() external view returns (address);
    function balance() external view returns (uint256);

    function withdraw(address to, uint256 amount) external;
}
