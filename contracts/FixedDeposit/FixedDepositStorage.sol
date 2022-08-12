// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import { Deposit } from "../libraries/DepositTypes.sol";


contract FixedDepositStorage {
    uint256 public balance;
    uint256 public depositHardCap;
    uint256 public lastDepositIndex;

    mapping(uint256 => Deposit) public deposits;
    
    mapping(address => uint8) public userDepositCount;
    mapping(address => uint256) public userDepositHardCap;
    mapping(address => uint256) public userPrincipal;
}