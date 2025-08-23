// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CredentialNFT.sol";
import "./CredentialRegistry.sol";

/**
 * @title VerificationContract
 * @dev Contract for handling credential verification logic and providing verification services
 */
contract VerificationContract {
    CredentialNFT public credentialContract;
    CredentialRegistry public registryContract;
    
    struct VerificationResult {
        bool isValid;
        bool exists;
        bool expired;
        bool revoked;
        address issuer;
        address recipient;
        string credentialType;
        string institutionName;
        uint256 issueDate;
        string message;
    }
    
    // Verification statistics
    mapping(uint256 => uint256) public verificationCount; // tokenId => count
    mapping(address => uint256) public verifierCount; // verifier => count
    uint256 public totalVerifications;
    
    event CredentialVerified(uint256 indexed tokenId, address indexed verifier, bool isValid);
    event BatchVerificationCompleted(uint256[] tokenIds, address indexed verifier);
    
    constructor(address _credentialContract, address _registryContract) {
        credentialContract = CredentialNFT(_credentialContract);
        registryContract = CredentialRegistry(_registryContract);
    }
    
    /**
     * @dev Main verification function with detailed results
     * @param tokenId ID of the credential to verify
     * @return VerificationResult struct with comprehensive verification data
     */
    function verifyCredentialDetailed(uint256 tokenId) public returns (VerificationResult memory) {
        // Increment verification statistics
        verificationCount[tokenId]++;
        verifierCount[msg.sender]++;
        totalVerifications++;
        
        try credentialContract.verifyCredential(tokenId) returns (
            bool isValid,
            address issuer,
            address recipient,
            string memory credentialType,
            string memory institutionName,
            uint256 issueDate,
            bool expired,
            bool revoked
        ) {
            string memory message = "";
            bool finalValid = isValid;
            
            // Additional validation checks
            if (revoked) {
                message = "Credential has been revoked by issuer";
                finalValid = false;
            } else if (expired) {
                message = "Credential has expired";
                finalValid = false;
            } else if (!registryContract.isAuthorizedIssuer(issuer)) {
                message = "Issuer is no longer authorized";
                finalValid = false;
            } else if (isValid) {
                message = "Credential is valid and verified";
            } else {
                message = "Credential is invalid";
            }
            
            emit CredentialVerified(tokenId, msg.sender, finalValid);
            
            return VerificationResult({
                isValid: finalValid,
                exists: true,
                expired: expired,
                revoked: revoked,
                issuer: issuer,
                recipient: recipient,
                credentialType: credentialType,
                institutionName: institutionName,
                issueDate: issueDate,
                message: message
            });
            
        } catch {
            emit CredentialVerified(tokenId, msg.sender, false);
            
            return VerificationResult({
                isValid: false,
                exists: false,
                expired: false,
                revoked: false,
                issuer: address(0),
                recipient: address(0),
                credentialType: "",
                institutionName: "",
                issueDate: 0,
                message: "Credential does not exist"
            });
        }
    }
    
    /**
     * @dev Batch verification for multiple credentials
     * @param tokenIds Array of token IDs to verify
     * @return Array of VerificationResult structs
     */
    function batchVerifyCredentials(uint256[] memory tokenIds) public returns (VerificationResult[] memory) {
        VerificationResult[] memory results = new VerificationResult[](tokenIds.length);
        
        for (uint i = 0; i < tokenIds.length; i++) {
            results[i] = verifyCredentialDetailed(tokenIds[i]);
        }
        
        emit BatchVerificationCompleted(tokenIds, msg.sender);
        return results;
    }
    
    /**
     * @dev Quick verification (returns only boolean) - view function for gas efficiency
     * @param tokenId ID of the credential to verify
     * @return True if credential is valid, false otherwise
     */
    function quickVerify(uint256 tokenId) public view returns (bool) {
        try credentialContract.verifyCredential(tokenId) returns (
            bool isValid,
            address issuer,
            address,
            string memory,
            string memory,
            uint256,
            bool,
            bool
        ) {
            return isValid && registryContract.isAuthorizedIssuer(issuer);
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Verify multiple credentials quickly
     * @param tokenIds Array of token IDs to verify
     * @return Array of boolean results
     */
    function quickBatchVerify(uint256[] memory tokenIds) public view returns (bool[] memory) {
        bool[] memory results = new bool[](tokenIds.length);
        
        for (uint i = 0; i < tokenIds.length; i++) {
            results[i] = quickVerify(tokenIds[i]);
        }
        
        return results;
    }
    
    /**
     * @dev Get verification statistics for a credential
     * @param tokenId ID of the credential
     * @return Number of times this credential has been verified
     */
    function getCredentialVerificationCount(uint256 tokenId) public view returns (uint256) {
        return verificationCount[tokenId];
    }
    
    /**
     * @dev Get verification statistics for a verifier
     * @param verifier Address of the verifier
     * @return Number of verifications performed by this address
     */
    function getVerifierCount(address verifier) public view returns (uint256) {
        return verifierCount[verifier];
    }
    
    /**
     * @dev Get total number of verifications performed
     * @return Total verification count across all credentials
     */
    function getTotalVerifications() public view returns (uint256) {
        return totalVerifications;
    }
    
    /**
     * @dev Verify credential ownership
     * @param tokenId ID of the credential
     * @param claimedOwner Address claiming to own the credential
     * @return True if the address owns the credential, false otherwise
     */
    function verifyOwnership(uint256 tokenId, address claimedOwner) public view returns (bool) {
        try credentialContract.ownerOf(tokenId) returns (address actualOwner) {
            return actualOwner == claimedOwner;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Verify if credential was issued by a specific institution
     * @param tokenId ID of the credential
     * @param institutionAddress Address of the institution
     * @return True if credential was issued by the institution, false otherwise
     */
    function verifyIssuer(uint256 tokenId, address institutionAddress) public view returns (bool) {
        try credentialContract.verifyCredential(tokenId) returns (
            bool,
            address issuer,
            address,
            string memory,
            string memory,
            uint256,
            bool,
            bool
        ) {
            return issuer == institutionAddress;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Get comprehensive credential information for verification display
     * @param tokenId ID of the credential
     * @return exists Whether the credential exists
     * @return issuer Address of the credential issuer
     * @return recipient Address of the credential recipient
     * @return credentialType Type of the credential
     * @return institutionName Name of the issuing institution
     * @return issueDate Date when credential was issued
     * @return expiryDate Date when credential expires
     * @return isValid Whether the credential is currently valid
     * @return expired Whether the credential has expired
     * @return revoked Whether the credential has been revoked
     * @return ipfsHash IPFS hash of credential metadata
     * @return verifications Number of times this credential has been verified
     */
    function getCredentialInfo(uint256 tokenId) public view returns (
        bool exists,
        address issuer,
        address recipient,
        string memory credentialType,
        string memory institutionName,
        uint256 issueDate,
        uint256 expiryDate,
        bool isValid,
        bool expired,
        bool revoked,
        string memory ipfsHash,
        uint256 verifications
    ) {
        try credentialContract.verifyCredential(tokenId) returns (
            bool _isValid,
            address _issuer,
            address _recipient,
            string memory _credentialType,
            string memory _institutionName,
            uint256 _issueDate,
            bool _expired,
            bool _revoked
        ) {
            // For now, we'll use empty values for expiryDate and ipfsHash
            // These would need to be retrieved separately if needed
            return (
                true,
                _issuer,
                _recipient,
                _credentialType,
                _institutionName,
                _issueDate,
                0, // expiryDate - would need separate call
                _isValid,
                _expired,
                _revoked,
                "", // ipfsHash - would need separate call
                verificationCount[tokenId]
            );
        } catch {
            return (
                false,
                address(0),
                address(0),
                "",
                "",
                0,
                0,
                false,
                false,
                false,
                "",
                0
            );
        }
    }
    
    /**
     * @dev Update contract addresses (only owner)
     * @param _credentialContract New credential contract address
     * @param _registryContract New registry contract address
     */
    function updateContracts(
        address _credentialContract,
        address _registryContract
    ) public {
        // Only allow the registry contract owner to update
        require(
            msg.sender == registryContract.owner(),
            "Only registry owner can update contracts"
        );
        
        credentialContract = CredentialNFT(_credentialContract);
        registryContract = CredentialRegistry(_registryContract);
    }
}
