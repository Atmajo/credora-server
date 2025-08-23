const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Credential Passport Contracts", function () {
  let credentialRegistry;
  let credentialNFT;
  let verificationContract;
  let credentialFactory;
  let owner;
  let institution;
  let student;
  let addrs;

  // Sample credential data
  const sampleCredential = {
    credentialType: "Degree",
    issuerName: "MIT",
    recipientName: "John Doe",
    achievementTitle: "Bachelor of Computer Science",
    issuanceDate: Math.floor(Date.now() / 1000),
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
    ipfsHash: "QmSampleHashForTesting123",
    additionalData: "Grade: A+",
  };

  beforeEach(async function () {
    // Get signers
    [owner, institution, student, ...addrs] = await ethers.getSigners();

    // Deploy CredentialRegistry
    const CredentialRegistry = await ethers.getContractFactory(
      "CredentialRegistry"
    );
    credentialRegistry = await CredentialRegistry.deploy();
    await credentialRegistry.waitForDeployment();

    // Deploy CredentialNFT
    const CredentialNFT = await ethers.getContractFactory("CredentialNFT");
    credentialNFT = await CredentialNFT.deploy(
      await credentialRegistry.getAddress()
    );
    await credentialNFT.waitForDeployment();

    // Deploy VerificationContract
    const VerificationContract = await ethers.getContractFactory(
      "VerificationContract"
    );
    verificationContract = await VerificationContract.deploy(
      await credentialNFT.getAddress(),
      await credentialRegistry.getAddress()
    );
    await verificationContract.waitForDeployment();

    // Deploy CredentialFactory
    const CredentialFactory = await ethers.getContractFactory(
      "CredentialFactory"
    );
    credentialFactory = await CredentialFactory.deploy();
    await credentialFactory.waitForDeployment();

    // Register institution
    await credentialRegistry.registerInstitution(
      institution.address,
      "Massachusetts Institute of Technology",
      "https://mit.edu",
      "admin@mit.edu",
      "QmHash123"
    );

    // Verify institution to make it authorized
    await credentialRegistry.verifyInstitution(institution.address);
  });

  describe("CredentialRegistry", function () {
    it("Should register an institution", async function () {
      const institutionData = await credentialRegistry.institutions(
        institution.address
      );
      expect(institutionData.name).to.equal(
        "Massachusetts Institute of Technology"
      );
      expect(institutionData.verified).to.equal(true);
    });

    it("Should allow admin to deactivate institution", async function () {
      await credentialRegistry.revokeInstitution(institution.address);
      const institutionData = await credentialRegistry.institutions(
        institution.address
      );
      expect(institutionData.verified).to.equal(false);
    });

    it("Should not allow non-admin to register institution", async function () {
      await expect(
        credentialRegistry
          .connect(student)
          .registerInstitution(
            addrs[0].address,
            "Test University",
            "https://testuni.edu",
            "admin@testuni.edu",
            "QmTestHash"
          )
      ).to.be.reverted;
    });
  });

  describe("CredentialNFT", function () {
    it("Should mint a credential NFT", async function () {
      await credentialNFT
        .connect(institution)
        .issueCredential(
          student.address,
          sampleCredential.credentialType,
          sampleCredential.issuerName,
          sampleCredential.expirationDate,
          sampleCredential.ipfsHash,
          "https://metadata.uri"
        );

      const balance = await credentialNFT.balanceOf(student.address);
      expect(balance).to.equal(1);

      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      const tokenId = userCredentials[0];
      const credential = await credentialNFT.getCredential(tokenId);
      expect(credential.recipient).to.equal(student.address);
    });

    it("Should not allow unauthorized issuer to mint", async function () {
      await expect(
        credentialNFT
          .connect(student)
          .issueCredential(
            student.address,
            sampleCredential.credentialType,
            sampleCredential.issuerName,
            sampleCredential.expirationDate,
            sampleCredential.ipfsHash,
            "https://metadata.uri"
          )
      ).to.be.revertedWith("Not authorized issuer");
    });

    it("Should revoke a credential", async function () {
      // First issue a credential
      await credentialNFT
        .connect(institution)
        .issueCredential(
          student.address,
          sampleCredential.credentialType,
          sampleCredential.issuerName,
          sampleCredential.expirationDate,
          sampleCredential.ipfsHash,
          "https://metadata.uri"
        );

      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      const tokenId = userCredentials[0];

      // Revoke it
      await credentialNFT.connect(institution).revokeCredential(tokenId);

      const credential = await credentialNFT.getCredential(tokenId);
      expect(credential.revoked).to.equal(true);
    });
  });

  describe("VerificationContract", function () {
    let tokenId;

    beforeEach(async function () {
      // Issue a credential for testing
      await credentialNFT
        .connect(institution)
        .issueCredential(
          student.address,
          sampleCredential.credentialType,
          sampleCredential.issuerName,
          sampleCredential.expirationDate,
          sampleCredential.ipfsHash,
          "https://metadata.uri"
        );
      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      tokenId = userCredentials[0];
    });

    it("Should verify a valid credential", async function () {
      const result = await verificationContract.verifyCredentialDetailed.staticCall(
        tokenId
      );
      expect(result.isValid).to.equal(true);
      expect(result.exists).to.equal(true);
      expect(result.revoked).to.equal(false);
      expect(result.expired).to.equal(false);
    });

    it("Should detect expired credential", async function () {
      // Issue an expired credential
      const expiredDate = Math.floor(Date.now() / 1000) - 24 * 60 * 60; // 1 day ago

      await credentialNFT
        .connect(institution)
        .issueCredential(
          student.address,
          "Expired Certificate",
          sampleCredential.issuerName,
          expiredDate,
          sampleCredential.ipfsHash,
          "https://metadata.uri"
        );

      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      const expiredTokenId = userCredentials[1];
      const result = await verificationContract.verifyCredentialDetailed.staticCall(
        expiredTokenId
      );

      expect(result.isValid).to.equal(false);
      expect(result.expired).to.equal(true);
    });

    it("Should detect revoked credential", async function () {
      // Revoke the credential
      await credentialNFT.connect(institution).revokeCredential(tokenId);

      const result = await verificationContract.verifyCredentialDetailed.staticCall(
        tokenId
      );
      expect(result.isValid).to.equal(false);
      expect(result.revoked).to.equal(true);
    });

    it("Should detect inactive issuer", async function () {
      // Deactivate the institution
      await credentialRegistry.revokeInstitution(institution.address);

      const result = await verificationContract.verifyCredentialDetailed.staticCall(
        tokenId
      );
      expect(result.isValid).to.equal(false);
    });

    it("Should get credential details", async function () {
      const info = await verificationContract.getCredentialInfo(tokenId);
      expect(info.recipient).to.equal(student.address);
      expect(info.credentialType).to.equal(sampleCredential.credentialType);
      expect(info.institutionName).to.equal(sampleCredential.issuerName);
    });
  });

  describe("CredentialFactory", function () {
    it("Should deploy complete system", async function () {
      const result = await credentialFactory.deploySystem();

      // Check that the transaction succeeded
      expect(result).to.not.be.undefined;

      // Check that addresses are set
      const addresses = await credentialFactory.getAddresses();
      expect(addresses[0]).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      ); // registry
      expect(addresses[1]).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      ); // credential
      expect(addresses[2]).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      ); // verification
    });

    it("Should emit deployment events", async function () {
      await expect(credentialFactory.deploySystem()).to.emit(
        credentialFactory,
        "SystemDeployed"
      );
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete credential lifecycle", async function () {
      // 1. Issue credential
      await credentialNFT
        .connect(institution)
        .issueCredential(
          student.address,
          sampleCredential.credentialType,
          sampleCredential.issuerName,
          sampleCredential.expirationDate,
          sampleCredential.ipfsHash,
          "https://metadata.uri"
        );

      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      const tokenId = userCredentials[0];

      // 2. Verify credential is valid
      let result = await verificationContract.verifyCredentialDetailed.staticCall(tokenId);
      expect(result.isValid).to.equal(true);

      // 3. Verify still valid after time passes
      result = await verificationContract.verifyCredentialDetailed.staticCall(tokenId);
      expect(result.isValid).to.equal(true);

      // 4. Revoke credential
      await credentialNFT.connect(institution).revokeCredential(tokenId);

      // 5. Verify now invalid
      result = await verificationContract.verifyCredentialDetailed.staticCall(tokenId);
      expect(result.isValid).to.equal(false);
      expect(result.revoked).to.equal(true);
    });
    
    it("Should handle multiple credentials per student", async function () {
      // Issue multiple credentials
      for (let i = 0; i < 3; i++) {
        await credentialNFT
          .connect(institution)
          .issueCredential(
            student.address,
            `Type ${i}`,
            sampleCredential.issuerName,
            sampleCredential.expirationDate,
            `ipfs_hash_${i}`,
            `https://metadata.uri/${i}`
          );
      }

      const balance = await credentialNFT.balanceOf(student.address);
      expect(balance).to.equal(3);

      // Verify all credentials
      const userCredentials = await credentialNFT.getUserCredentials(
        student.address
      );
      for (let i = 0; i < 3; i++) {
        const tokenId = userCredentials[i];
        const result = await verificationContract.verifyCredentialDetailed.staticCall(
          tokenId
        );
        expect(result.isValid).to.equal(true);
      }
    });
  });
});
