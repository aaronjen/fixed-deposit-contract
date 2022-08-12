// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.9;

import { DepositDuration } from "../libraries/DepositTypes.sol";

interface IFixedDeposit {
    event SetDepositCapForAll(uint256 amount);

    event Withdraw(uint256 amount);

    event UserDeposit(uint256 id, address indexed user, DepositDuration indexed duration, uint256 amount);

    event UserCloseDeposit(uint256 id, address indexed user, uint256 amount);

    event UserWithdrawInterest(uint256 id, address indexed user, uint256 amount);

    // admin funcions
    function setDepositCapForAll(uint256 amount) external;

    function setDepositCapForAddress(address user, uint256 amount) external;

    function withdraw(uint256 amount) external;


    // user functions
    function fixedDeposit(DepositDuration duration) external payable;

    function userCloseDeposit(uint256 depositId) external;

    function userWithdrawInterest(uint256 depositId) external;
}