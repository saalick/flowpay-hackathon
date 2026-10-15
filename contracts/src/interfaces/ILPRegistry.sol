// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LPRegistry — liquidity-provider stake + rail metadata
/// @notice LPs stake USDC as collateral. On accept, FlowSettlement locks part
///         of the stake; on dispute or payWindow miss, FlowSettlement slashes it.
interface ILPRegistry {
    error NotSettlement();
    error AlreadyRegistered();
    error NotRegistered();
    error InsufficientFreeStake();
    error LockUnderflow();
    error ZeroAmount();

    event LPRegistered(address indexed lp, bytes3 currency, string rail, uint16 spreadBps);
    event LPUpdated(address indexed lp, bytes3 currency, string rail, uint16 spreadBps);
    event Staked(address indexed lp, uint256 amount, uint256 totalStake);
    event Unstaked(address indexed lp, uint256 amount, uint256 totalStake);
    event StakeLocked(address indexed lp, uint256 amount, bytes32 indexed orderId);
    event StakeUnlocked(address indexed lp, uint256 amount, bytes32 indexed orderId);
    event Slashed(address indexed lp, uint256 amount, address indexed to, bytes32 indexed orderId);

    struct LP {
        address addr;
        bytes3 currency;    // currency the LP settles (e.g. "THB")
        string rail;        // e.g. "PROMPTPAY"
        uint16 spreadBps;   // LP's quoted spread over mid
        bool registered;
    }

    function usdc() external view returns (address);
    function settlement() external view returns (address);
    function lpOf(address lp) external view returns (LP memory);
    function totalStake(address lp) external view returns (uint256);
    function lockedStake(address lp) external view returns (uint256);
    function freeStake(address lp) external view returns (uint256);
    function isRegistered(address lp) external view returns (bool);
    function registeredFor(bytes3 currency, address lp) external view returns (bool);

    // --- LP self-serve ---
    function register(bytes3 currency, string calldata rail, uint16 spreadBps) external;
    function update(bytes3 currency, string calldata rail, uint16 spreadBps) external;
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;

    // --- settlement-only hooks ---
    function lockStake(address lp, uint256 amount, bytes32 orderId) external;
    function unlockStake(address lp, uint256 amount, bytes32 orderId) external;
    function slash(address lp, uint256 amount, address to, bytes32 orderId) external;
}
