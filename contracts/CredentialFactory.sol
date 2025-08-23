// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CredentialNFT.sol";
import "./CredentialRegistry.sol";
import "./VerificationContract.sol";

contract CredentialFactory {
    address public owner;
    address public registryContract;
    address public credentialContract;
    address public verificationContract;
    
    event SystemDeployed();

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function deploySystem() public onlyOwner {
        require(registryContract == address(0));
        registryContract = address(new CredentialRegistry());
        credentialContract = address(new CredentialNFT(registryContract));
        verificationContract = address(new VerificationContract(credentialContract, registryContract));
        emit SystemDeployed();
    }

    function getAddresses() external view returns (address, address, address) {
        return (registryContract, credentialContract, verificationContract);
    }
}
