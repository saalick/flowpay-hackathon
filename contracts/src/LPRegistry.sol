// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ILPRegistry } from "./interfaces/ILPRegistry.sol";

/// @title LPRegistry
/// @notice LPs stake USDC. On accept, FlowSettlement locks part of the stake;
///         on dispute or pay-window miss, FlowSettlement slashes it. Settlement
///         address is immutable — set at deploy from a predicted address.
contract LPRegistry is ILPRegistry, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    address public immutable settlementAddr;

    mapping(address => LP) private _lps;
    mapping(address => uint256) private _total;
    mapping(address => uint256) private _locked;

    constructor(address usdc_, address settlement_) {
        if (usdc_ == address(0) || settlement_ == address(0)) revert ZeroAmount();
        usdcToken = IERC20(usdc_);
        settlementAddr = settlement_;
    }

    modifier onlySettlement() {
        if (msg.sender != settlementAddr) revert NotSettlement();
        _;
    }

    function usdc() external view returns (address) { return address(usdcToken); }
    function settlement() external view returns (address) { return settlementAddr; }
    function lpOf(address lp) external view returns (LP memory) { return _lps[lp]; }
    function totalStake(address lp) external view returns (uint256) { return _total[lp]; }
    function lockedStake(address lp) external view returns (uint256) { return _locked[lp]; }
    function freeStake(address lp) public view returns (uint256) {
        return _total[lp] - _locked[lp];
    }
    function isRegistered(address lp) external view returns (bool) {
        return _lps[lp].registered;
    }
    function registeredFor(bytes3 currency, address lp) external view returns (bool) {
        return _lps[lp].registered && _lps[lp].currency == currency;
    }

    function register(bytes3 currency, string calldata rail, uint16 spreadBps) external {
        if (_lps[msg.sender].registered) revert AlreadyRegistered();
        _lps[msg.sender] = LP({
            addr: msg.sender,
            currency: currency,
            rail: rail,
            spreadBps: spreadBps,
            registered: true
        });
        emit LPRegistered(msg.sender, currency, rail, spreadBps);
    }

    function update(bytes3 currency, string calldata rail, uint16 spreadBps) external {
        if (!_lps[msg.sender].registered) revert NotRegistered();
        _lps[msg.sender].currency = currency;
        _lps[msg.sender].rail = rail;
        _lps[msg.sender].spreadBps = spreadBps;
        emit LPUpdated(msg.sender, currency, rail, spreadBps);
    }

    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!_lps[msg.sender].registered) revert NotRegistered();
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        _total[msg.sender] += amount;
        emit Staked(msg.sender, amount, _total[msg.sender]);
    }

    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (freeStake(msg.sender) < amount) revert InsufficientFreeStake();
        _total[msg.sender] -= amount;
        usdcToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, _total[msg.sender]);
    }

    function lockStake(address lp, uint256 amount, bytes32 orderId) external onlySettlement {
        if (freeStake(lp) < amount) revert InsufficientFreeStake();
        _locked[lp] += amount;
        emit StakeLocked(lp, amount, orderId);
    }

    function unlockStake(address lp, uint256 amount, bytes32 orderId) external onlySettlement {
        if (_locked[lp] < amount) revert LockUnderflow();
        _locked[lp] -= amount;
        emit StakeUnlocked(lp, amount, orderId);
    }

    function slash(address lp, uint256 amount, address to, bytes32 orderId) external onlySettlement nonReentrant {
        if (_locked[lp] < amount) revert LockUnderflow();
        _locked[lp] -= amount;
        _total[lp] -= amount;
        usdcToken.safeTransfer(to, amount);
        emit Slashed(lp, amount, to, orderId);
    }
}
