// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ITreasuryVault } from "./interfaces/ITreasuryVault.sol";

/// @title TreasuryVault
/// @notice Holds USDC that funded float payouts and absorbed protocol fees.
///         Admin can withdraw. In production this contract's admin role would
///         be a multisig; here it is a single EOA (noted in the README).
contract TreasuryVault is ITreasuryVault, AccessControl {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;

    constructor(address usdc_, address admin_) {
        if (usdc_ == address(0) || admin_ == address(0)) revert ZeroAmount();
        usdcToken = IERC20(usdc_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    function usdc() external view returns (address) {
        return address(usdcToken);
    }

    function balance() public view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }

    function withdraw(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount == 0) revert ZeroAmount();
        if (balance() < amount) revert InsufficientBalance();
        usdcToken.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }
}
