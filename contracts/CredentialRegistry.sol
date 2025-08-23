// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredentialRegistry
 * @dev Contract for managing authorized institutions that can issue credentials
 */
contract CredentialRegistry is Ownable {
    
    struct Institution {
        string name;
        string website;
        string email;
        address walletAddress;
        bool verified;
        uint256 registrationDate;
        uint256 credentialsIssued;
        string documentHash; // IPFS hash of verification documents
    }
    
    mapping(address => Institution) public institutions;
    mapping(address => bool) public authorizedIssuers;
    address[] public issuerList;
    
    // Mapping to track admin addresses
    mapping(address => bool) public admins;
    
    event InstitutionRegistered(address indexed institution, string name);
    event InstitutionVerified(address indexed institution);
    event InstitutionRevoked(address indexed institution);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    
    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not authorized admin");
        _;
    }
    
    constructor() {
        admins[msg.sender] = true;
    }
    
    /**
     * @dev Add a new admin
     * @param admin Address to add as admin
     */
    function addAdmin(address admin) public onlyOwner {
        admins[admin] = true;
        emit AdminAdded(admin);
    }
    
    /**
     * @dev Remove an admin
     * @param admin Address to remove from admin
     */
    function removeAdmin(address admin) public onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }
    
    /**
     * @dev Register a new institution (requires admin approval)
     * @param institutionAddress Wallet address of the institution
     * @param name Name of the institution
     * @param website Website URL
     * @param email Contact email
     * @param documentHash IPFS hash of verification documents
     */
    function registerInstitution(
        address institutionAddress,
        string memory name,
        string memory website,
        string memory email,
        string memory documentHash
    ) public onlyAdmin {
        require(institutionAddress != address(0), "Invalid address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(institutions[institutionAddress].name).length == 0, "Institution already registered");
        
        institutions[institutionAddress] = Institution({
            name: name,
            website: website,
            email: email,
            walletAddress: institutionAddress,
            verified: false,
            registrationDate: block.timestamp,
            credentialsIssued: 0,
            documentHash: documentHash
        });
        
        emit InstitutionRegistered(institutionAddress, name);
    }
    
    /**
     * @dev Verify and authorize an institution to issue credentials
     * @param institutionAddress Address of the institution to verify
     */
    function verifyInstitution(address institutionAddress) public onlyAdmin {
        require(bytes(institutions[institutionAddress].name).length > 0, "Institution not registered");
        require(!institutions[institutionAddress].verified, "Already verified");
        
        institutions[institutionAddress].verified = true;
        authorizedIssuers[institutionAddress] = true;
        issuerList.push(institutionAddress);
        
        emit InstitutionVerified(institutionAddress);
    }
    
    /**
     * @dev Revoke institution's authorization
     * @param institutionAddress Address of the institution to revoke
     */
    function revokeInstitution(address institutionAddress) public onlyAdmin {
        require(authorizedIssuers[institutionAddress], "Institution not authorized");
        
        authorizedIssuers[institutionAddress] = false;
        institutions[institutionAddress].verified = false;
        
        // Remove from issuer list
        for (uint i = 0; i < issuerList.length; i++) {
            if (issuerList[i] == institutionAddress) {
                issuerList[i] = issuerList[issuerList.length - 1];
                issuerList.pop();
                break;
            }
        }
        
        emit InstitutionRevoked(institutionAddress);
    }
    
    /**
     * @dev Check if an address is authorized to issue credentials
     * @param issuer Address to check
     * @return True if authorized, false otherwise
     */
    function isAuthorizedIssuer(address issuer) public view returns (bool) {
        return authorizedIssuers[issuer];
    }
    
    /**
     * @dev Get institution details
     * @param institutionAddress Address of the institution
     * @return Institution struct with all details
     */
    function getInstitution(address institutionAddress) public view returns (Institution memory) {
        return institutions[institutionAddress];
    }
    
    /**
     * @dev Get all authorized issuers
     * @return Array of authorized issuer addresses
     */
    function getAllIssuers() public view returns (address[] memory) {
        return issuerList;
    }
    
    /**
     * @dev Get verified institutions count
     * @return Number of verified institutions
     */
    function getVerifiedInstitutionsCount() public view returns (uint256) {
        return issuerList.length;
    }
    
    /**
     * @dev Increment credential count for an institution
     * @param issuer Address of the issuer
     */
    function incrementCredentialCount(address issuer) external {
        require(authorizedIssuers[issuer], "Not authorized issuer");
        institutions[issuer].credentialsIssued++;
    }
    
    /**
     * @dev Update institution information
     * @param institutionAddress Address of the institution
     * @param name New name
     * @param website New website
     * @param email New email
     */
    function updateInstitutionInfo(
        address institutionAddress,
        string memory name,
        string memory website,
        string memory email
    ) public onlyAdmin {
        require(bytes(institutions[institutionAddress].name).length > 0, "Institution not registered");
        
        Institution storage institution = institutions[institutionAddress];
        institution.name = name;
        institution.website = website;
        institution.email = email;
    }
    
    /**
     * @dev Update institution verification documents
     * @param institutionAddress Address of the institution
     * @param documentHash New IPFS hash of verification documents
     */
    function updateInstitutionDocuments(
        address institutionAddress,
        string memory documentHash
    ) public onlyAdmin {
        require(bytes(institutions[institutionAddress].name).length > 0, "Institution not registered");
        institutions[institutionAddress].documentHash = documentHash;
    }
    
    /**
     * @dev Check if an address is an admin
     * @param account Address to check
     * @return True if admin, false otherwise
     */
    function isAdmin(address account) public view returns (bool) {
        return admins[account] || account == owner();
    }
    
    /**
     * @dev Get institution statistics
     * @param institutionAddress Address of the institution
     * @return name Name of the institution
     * @return verified Whether the institution is verified
     * @return credentialsIssued Number of credentials issued
     * @return registrationDate When the institution was registered
     */
    function getInstitutionStats(address institutionAddress) public view returns (
        string memory name,
        bool verified,
        uint256 credentialsIssued,
        uint256 registrationDate
    ) {
        Institution memory institution = institutions[institutionAddress];
        return (
            institution.name,
            institution.verified,
            institution.credentialsIssued,
            institution.registrationDate
        );
    }
}
