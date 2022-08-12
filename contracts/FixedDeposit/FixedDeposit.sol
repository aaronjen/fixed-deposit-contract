// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
// import "hardhat/console.sol";
import "solmate/src/auth/Owned.sol";

import { IFixedDeposit } from "../interfaces/IFixedDeposit.sol";
import { FixedDepositStorage } from "./FixedDepositStorage.sol";
import { DepositDuration, Deposit } from "../libraries/DepositTypes.sol";

contract FixedDeposit is IFixedDeposit, Owned, FixedDepositStorage {
    mapping(DepositDuration => uint) public depositTime;
    mapping(DepositDuration => uint) public interestRate;

    constructor(uint256 amount) Owned(msg.sender) {
        depositTime[DepositDuration.Day1] = 1 days;
        depositTime[DepositDuration.Day7] = 7 days;
        depositTime[DepositDuration.Day30] = 30 days;
        depositTime[DepositDuration.Day90] = 90 days;
        depositTime[DepositDuration.Day180] = 180 days;
        depositTime[DepositDuration.Day365] = 365 days;

        interestRate[DepositDuration.Day1] = 1;
        interestRate[DepositDuration.Day7] = 10;
        interestRate[DepositDuration.Day30] = 70;
        interestRate[DepositDuration.Day90] = 250;
        interestRate[DepositDuration.Day180] = 1000;
        interestRate[DepositDuration.Day365] = 3000;

        depositHardCap = amount;
    }

    fallback () external payable {}

    receive () external payable {}

    function setDepositCapForAll(uint256 amount) external onlyOwner {
        depositHardCap = amount;
    }

    function setDepositCapForAddress(address user, uint256 amount) external onlyOwner {
        userDepositHardCap[user] = amount;
    }

    function withdraw(uint256 amount) external onlyOwner {
        require(balance >= amount, "fund not enough to withdraw");
        balance -= amount;

        address payable _to = payable(msg.sender);
        
        _to.transfer(amount);
    }


    // user functions
    function fixedDeposit(DepositDuration duration) external payable {
        require(uint8(duration) < 6, "not a valid duration");
        require(balance + msg.value <= depositHardCap, "reach total deposit cap");
        require(userDepositCount[msg.sender] < 16, "reach deposit count limit by user");
        balance += msg.value;
        userPrincipal[msg.sender] += msg.value;
        if(userDepositHardCap[msg.sender] > 0) {
            require(userPrincipal[msg.sender] <= userDepositHardCap[msg.sender], "reach user deposit cap");
        }

        uint256 maturityTime = block.timestamp + depositTime[duration];
        Deposit memory _deposit = Deposit(duration, msg.value, msg.sender, maturityTime, block.timestamp, false);
        uint256 id = lastDepositIndex;
        deposits[id] = _deposit;
        userDepositCount[msg.sender] += 1;
        lastDepositIndex += 1;

        emit UserDeposit(id, msg.sender, duration, msg.value);
    }

    function userCloseDeposit(uint256 depositId) external {
        Deposit  memory _deposit = deposits[depositId];
        require(_deposit.owner == msg.sender, "sender should be deposit user");
        require(!_deposit.closed, "already closed");
        address payable sender = payable(msg.sender);

        userPrincipal[sender] -= _deposit.principal;
        deposits[depositId].closed = true;
        userDepositCount[sender] -= 1;

        uint256 amount = _deposit.principal + getDepositInterest(depositId);
        sender.transfer(amount);
    }

    function userWithdrawInterest(uint256 depositId) external {
        Deposit memory _deposit = deposits[depositId];
        require(_deposit.owner == msg.sender, "sender should be deposit user");

        address payable sender = payable(msg.sender);
        uint256 interest = getDepositInterest(depositId);
        sender.transfer(interest);
        deposits[depositId].lastWithdrawInterestTime = block.timestamp;
        emit UserWithdrawInterest(depositId, msg.sender, interest);
    }

    function getDepositInterest(uint256 id) public view returns (uint256) {
        Deposit memory _deposit = deposits[id];
        if(_deposit.lastWithdrawInterestTime > _deposit.maturityTime) {
            return 0;
        }

        uint time = block.timestamp;
        if(time > _deposit.maturityTime) {
            time = _deposit.maturityTime;
        }

        uint timeDiff = time - _deposit.lastWithdrawInterestTime;
        uint interest = interestRate[_deposit.duration];

        return _deposit.principal * timeDiff / 365 days * interest / 1e4;
    }

    function getDepositFund(uint256 id) public view returns (uint256) {
        return deposits[id].principal;
    }
}
