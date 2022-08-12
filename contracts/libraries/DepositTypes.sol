// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

enum DepositDuration {
    Day1,
    Day7,
    Day30,
    Day90,
    Day180,
    Day365
}

struct Deposit {
    DepositDuration duration;
    uint256 principal;    
    address owner;
    uint maturityTime;
    uint lastWithdrawInterestTime;
    bool closed;
}