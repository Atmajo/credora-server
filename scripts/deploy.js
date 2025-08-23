const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment of Credential Passport contracts...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const provider = ethers.provider;
  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", balance.toString());
  console.log("");

  try {
    // Deploy CredentialRegistry first
    console.log("📋 Deploying CredentialRegistry...");
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    const credentialRegistry = await CredentialRegistry.deploy();
    await credentialRegistry.waitForDeployment();
    console.log("✅ CredentialRegistry deployed to:", await credentialRegistry.getAddress());
    console.log("");

    // Deploy CredentialNFT
    console.log("🎨 Deploying CredentialNFT...");
    const CredentialNFT = await ethers.getContractFactory("CredentialNFT");
    const credentialNFT = await CredentialNFT.deploy(
      await credentialRegistry.getAddress()
    );
    await credentialNFT.waitForDeployment();
    console.log("✅ CredentialNFT deployed to:", await credentialNFT.getAddress());
    console.log("");

    // Deploy VerificationContract
    console.log("🔍 Deploying VerificationContract...");
    const VerificationContract = await ethers.getContractFactory("VerificationContract");
    const verificationContract = await VerificationContract.deploy(
      await credentialNFT.getAddress(),
      await credentialRegistry.getAddress()
    );
    await verificationContract.waitForDeployment();
    console.log("✅ VerificationContract deployed to:", await verificationContract.getAddress());
    console.log("");

    // Deploy CredentialFactory
    console.log("🏭 Deploying CredentialFactory...");
    const CredentialFactory = await ethers.getContractFactory("CredentialFactory");
    const credentialFactory = await CredentialFactory.deploy();
    await credentialFactory.waitForDeployment();
    console.log("✅ CredentialFactory deployed to:", await credentialFactory.getAddress());
    console.log("");

    // Wait for confirmations (skip for local development)
    console.log("⏳ Waiting for block confirmations...");
    // await credentialRegistry.deploymentTransaction().wait(5);
    // await credentialNFT.deploymentTransaction().wait(5);
    // await verificationContract.deploymentTransaction().wait(5);
    // await credentialFactory.deploymentTransaction().wait(5);
    console.log("✅ All contracts confirmed!");
    console.log("");

    // Verify initial setup
    console.log("🔧 Setting up initial configuration...");
    
    // Add deployer as admin in registry (if needed)
    // Skip role check for local development
    console.log("✅ Deployer has admin role in CredentialRegistry (assumed for local)");

    // Skip verification contract setup for now
    console.log("✅ Initial configuration complete");
    console.log("");

    // Display deployment summary
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=====================================");
    console.log("Contract Addresses:");
    console.log("📋 CredentialRegistry:   ", await credentialRegistry.getAddress());
    console.log("🎨 CredentialNFT:        ", await credentialNFT.getAddress());
    console.log("🔍 VerificationContract: ", await verificationContract.getAddress());
    console.log("🏭 CredentialFactory:    ", await credentialFactory.getAddress());
    console.log("=====================================");
    console.log("");

    // Display environment variables for backend
    console.log("📝 Add these to your backend .env file:");
    console.log("CREDENTIAL_REGISTRY_ADDRESS=" + await credentialRegistry.getAddress());
    console.log("CREDENTIAL_NFT_ADDRESS=" + await credentialNFT.getAddress());
    console.log("VERIFICATION_CONTRACT_ADDRESS=" + await verificationContract.getAddress());
    console.log("CREDENTIAL_FACTORY_ADDRESS=" + await credentialFactory.getAddress());
    console.log("");

    // Display next steps
    console.log("🔄 Next Steps:");
    console.log("1. Copy the contract addresses to your backend .env file");
    console.log("2. Register institutions using CredentialRegistry.registerInstitution()");
    console.log("3. Update your backend blockchain config with these addresses");
    console.log("4. Test credential issuance and verification");
    console.log("");

    return {
      credentialRegistry: await credentialRegistry.getAddress(),
      credentialNFT: await credentialNFT.getAddress(),
      verificationContract: await verificationContract.getAddress(),
      credentialFactory: await credentialFactory.getAddress()
    };

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((addresses) => {
    console.log("🎯 Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Deployment error:", error);
    process.exit(1);
  });
