// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./CredentialRegistry.sol";

/**
 * @title CredentialNFT
 * @dev Main contract for issuing and managing educational credentials as NFTs
 */
contract CredentialNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;
    
    // Credential Registry reference
    CredentialRegistry public registry;
    
    struct Credential {
        address issuer;           // Institution that issued the credential
        address recipient;        // Student who received it
        string credentialType;    // "Degree", "Certificate", "Course"
        string institutionName;   // Name of issuing institution
        uint256 issueDate;       // Timestamp when issued
        uint256 expiryDate;      // 0 for non-expiring credentials
        string ipfsHash;         // IPFS hash containing detailed metadata
        bool revoked;            // Can be revoked by issuer
    }
    
    mapping(uint256 => Credential) public credentials;
    mapping(address => uint256[]) public userCredentials;
    
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed issuer,
        address indexed recipient,
        string credentialType
    );
    
    event CredentialRevoked(uint256 indexed tokenId, address indexed issuer);
    
    /**
     * @dev Constructor sets the registry contract address
     * @param _registryAddress Address of the CredentialRegistry contract
     */
    constructor(address _registryAddress) ERC721("EducationCredential", "EDUC") {
        registry = CredentialRegistry(_registryAddress);
    }
    
    modifier onlyAuthorizedIssuer() {
        require(registry.isAuthorizedIssuer(msg.sender), "Not authorized issuer");
        _;
    }
    
    /**
     * @dev Issue a new credential NFT
     * @param recipient Address of the credential recipient
     * @param credentialType Type of credential (Degree, Certificate, etc.)
     * @param institutionName Name of the issuing institution
     * @param expiryDate Expiry timestamp (0 for non-expiring)
     * @param ipfsHash IPFS hash of credential metadata
     * @param tokenMetadataURI URI for the token metadata
     * @return tokenId The ID of the newly created token
     */
    function issueCredential(
        address recipient,
        string memory credentialType,
        string memory institutionName,
        uint256 expiryDate,
        string memory ipfsHash,
        string memory tokenMetadataURI
    ) public onlyAuthorizedIssuer returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        credentials[tokenId] = Credential({
            issuer: msg.sender,
            recipient: recipient,
            credentialType: credentialType,
            institutionName: institutionName,
            issueDate: block.timestamp,
            expiryDate: expiryDate,
            ipfsHash: ipfsHash,
            revoked: false
        });
        
        userCredentials[recipient].push(tokenId);
        
        _mint(recipient, tokenId);
        _setTokenURI(tokenId, tokenMetadataURI);
        
        // Increment credential count in registry
        registry.incrementCredentialCount(msg.sender);
        
        emit CredentialIssued(tokenId, msg.sender, recipient, credentialType);
        
        return tokenId;
    }
    
    /**
     * @dev Batch issue multiple credentials
     * @param recipients Array of recipient addresses
     * @param credentialTypes Array of credential types
     * @param institutionName Name of the issuing institution
     * @param expiryDate Expiry timestamp for all credentials
     * @param ipfsHashes Array of IPFS hashes
     * @param tokenURIs Array of token URIs
     */
    function batchIssueCredentials(
        address[] memory recipients,
        string[] memory credentialTypes,
        string memory institutionName,
        uint256 expiryDate,
        string[] memory ipfsHashes,
        string[] memory tokenURIs
    ) public onlyAuthorizedIssuer {
        require(recipients.length == credentialTypes.length, "Array length mismatch");
        require(recipients.length == ipfsHashes.length, "Array length mismatch");
        require(recipients.length == tokenURIs.length, "Array length mismatch");
        
        for (uint i = 0; i < recipients.length; i++) {
            issueCredential(
                recipients[i],
                credentialTypes[i],
                institutionName,
                expiryDate,
                ipfsHashes[i],
                tokenURIs[i]
            );
        }
    }
    
    /**
     * @dev Revoke a credential (only by original issuer)
     * @param tokenId ID of the credential to revoke
     */
    function revokeCredential(uint256 tokenId) public {
        require(_exists(tokenId), "Credential does not exist");
        require(credentials[tokenId].issuer == msg.sender, "Only issuer can revoke");
        require(!credentials[tokenId].revoked, "Already revoked");
        
        credentials[tokenId].revoked = true;
        emit CredentialRevoked(tokenId, msg.sender);
    }
    
    /**
     * @dev Verify if a credential is valid
     * @param tokenId ID of the credential to verify
     * @return isValid Whether the credential is valid
     * @return issuer Address of the issuer
     * @return recipient Address of the recipient
     * @return credentialType Type of the credential
     * @return institutionName Name of the issuing institution
     * @return issueDate Timestamp when the credential was issued
     * @return expired Whether the credential has expired
     * @return revoked Whether the credential has been revoked
     */
    function verifyCredential(uint256 tokenId) public view returns (
        bool isValid,
        address issuer,
        address recipient,
        string memory credentialType,
        string memory institutionName,
        uint256 issueDate,
        bool expired,
        bool revoked
    ) {
        require(_exists(tokenId), "Credential does not exist");
        
        Credential memory cred = credentials[tokenId];
        bool hasExpired = cred.expiryDate != 0 && block.timestamp > cred.expiryDate;
        
        return (
            !cred.revoked && !hasExpired,
            cred.issuer,
            cred.recipient,
            cred.credentialType,
            cred.institutionName,
            cred.issueDate,
            hasExpired,
            cred.revoked
        );
    }
    
    /**
     * @dev Get all credentials for a user
     * @param user Address of the user
     * @return Array of token IDs owned by the user
     */
    function getUserCredentials(address user) public view returns (uint256[] memory) {
        return userCredentials[user];
    }
    
    /**
     * @dev Get credential details by token ID
     * @param tokenId ID of the credential
     * @return Credential struct containing all credential data
     */
    function getCredential(uint256 tokenId) public view returns (Credential memory) {
        require(_exists(tokenId), "Credential does not exist");
        return credentials[tokenId];
    }
    
    /**
     * @dev Get total number of credentials issued
     * @return Total number of credentials
     */
    function getTotalCredentials() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    /**
     * @dev Update registry contract address (only owner)
     * @param _registryAddress New registry contract address
     */
    function updateRegistry(address _registryAddress) public onlyOwner {
        registry = CredentialRegistry(_registryAddress);
    }
}
