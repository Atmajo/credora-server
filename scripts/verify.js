const { run, ethers } = require("hardhat");

async function main() {
  console.log("🔍 Starting contract verification...\n");

  // Contract addresses - update these with your deployed addresses
  const addresses = {
    credentialRegistry: process.env.CREDENTIAL_REGISTRY_ADDRESS,
    credentialNFT: process.env.CREDENTIAL_NFT_ADDRESS,
    verificationContract: process.env.VERIFICATION_CONTRACT_ADDRESS,
    credentialFactory: process.env.CREDENTIAL_FACTORY_ADDRESS
  };

  // Check if addresses are provided
  for (const [name, address] of Object.entries(addresses)) {
    if (!address) {
      console.error(`❌ Missing address for ${name}. Please set environment variables.`);
      process.exit(1);
    }
  }

  try {
    // Verify CredentialRegistry
    console.log("📋 Verifying CredentialRegistry...");
    await run("verify:verify", {
      address: addresses.credentialRegistry,
      constructorArguments: []
    });
    console.log("✅ CredentialRegistry verified!");

    // Verify CredentialNFT
    console.log("🎨 Verifying CredentialNFT...");
    await run("verify:verify", {
      address: addresses.credentialNFT,
      constructorArguments: [
        "Credential Passport",
        "CRED",
        addresses.credentialRegistry
      ]
    });
    console.log("✅ CredentialNFT verified!");

    // Verify VerificationContract
    console.log("🔍 Verifying VerificationContract...");
    await run("verify:verify", {
      address: addresses.verificationContract,
      constructorArguments: [
        addresses.credentialNFT,
        addresses.credentialRegistry
      ]
    });
    console.log("✅ VerificationContract verified!");

    // Verify CredentialFactory
    console.log("🏭 Verifying CredentialFactory...");
    await run("verify:verify", {
      address: addresses.credentialFactory,
      constructorArguments: []
    });
    console.log("✅ CredentialFactory verified!");

    console.log("\n🎉 All contracts verified successfully!");

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log("✨ Verification complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Verification error:", error);
    process.exit(1);
  });
