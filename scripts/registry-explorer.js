const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 CredentialRegistry Explorer\n");

  // Get the deployed contract instance
  const registryAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = CredentialRegistry.attach(registryAddress);

  console.log("📋 Contract Address:", registryAddress);
  console.log("📋 Contract Instance:", registry.target);

  try {
    // 1. Get basic contract info
    console.log("\n=== BASIC CONTRACT INFO ===");
    const owner = await registry.owner();
    console.log("👤 Owner:", owner);

    // 2. Get verified institutions count
    console.log("\n=== INSTITUTIONS OVERVIEW ===");
    const verifiedCount = await registry.getVerifiedInstitutionsCount();
    console.log("🏛️  Verified Institutions Count:", verifiedCount.toString());

    // 3. Get all authorized issuers
    const allIssuers = await registry.getAllIssuers();
    console.log("📜 All Authorized Issuers:", allIssuers);

    // 4. Check if current deployer is admin
    const [deployer] = await ethers.getSigners();
    const isAdmin = await registry.isAdmin(deployer.address);
    console.log("🔐 Current account is admin:", isAdmin);

    // 5. If there are institutions, get their details
    if (allIssuers.length > 0) {
      console.log("\n=== INSTITUTION DETAILS ===");
      for (let i = 0; i < allIssuers.length; i++) {
        const issuerAddress = allIssuers[i];
        console.log(`\n🏛️  Institution ${i + 1}:`);
        console.log("📍 Address:", issuerAddress);

        // Get full institution details
        const institution = await registry.getInstitution(issuerAddress);
        console.log("🏷️  Name:", institution.name);
        console.log("🌐 Website:", institution.website);
        console.log("📧 Email:", institution.email);
        console.log("✅ Verified:", institution.verified);
        console.log("📅 Registration Date:", new Date(Number(institution.registrationDate) * 1000).toISOString());
        console.log("📊 Credentials Issued:", institution.credentialsIssued.toString());
        console.log("📄 Document Hash:", institution.documentHash);

        // Check authorization status
        const isAuthorized = await registry.isAuthorizedIssuer(issuerAddress);
        console.log("🔓 Is Authorized:", isAuthorized);
      }
    }

    // 6. Get contract events (recent ones)
    console.log("\n=== RECENT EVENTS ===");
    try {
      const currentBlock = await ethers.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks

      // Get all institution registered events
      const registeredEvents = await registry.queryFilter(
        registry.filters.InstitutionRegistered(),
        fromBlock,
        currentBlock
      );
      console.log("📝 Institution Registered Events:", registeredEvents.length);
      registeredEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. Institution: ${event.args.institution}, Name: ${event.args.name}`);
      });

      // Get all institution verified events
      const verifiedEvents = await registry.queryFilter(
        registry.filters.InstitutionVerified(),
        fromBlock,
        currentBlock
      );
      console.log("✅ Institution Verified Events:", verifiedEvents.length);
      verifiedEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. Institution: ${event.args.institution}`);
      });

      // Get admin events
      const adminAddedEvents = await registry.queryFilter(
        registry.filters.AdminAdded(),
        fromBlock,
        currentBlock
      );
      console.log("👑 Admin Added Events:", adminAddedEvents.length);
      adminAddedEvents.forEach((event, index) => {
        console.log(`   ${index + 1}. Admin: ${event.args.admin}`);
      });

    } catch (eventError) {
      console.log("⚠️  Could not fetch events:", eventError.message);
    }

    // 7. Check specific addresses (if you want to test specific ones)
    console.log("\n=== SPECIFIC ADDRESS CHECKS ===");
    const testAddresses = [
      deployer.address,
      "0x0000000000000000000000000000000000000000", // Zero address
      owner // Owner address
    ];

    for (const addr of testAddresses) {
      if (addr !== "0x0000000000000000000000000000000000000000") {
        console.log(`\n🔍 Checking address: ${addr}`);
        const isAdminCheck = await registry.isAdmin(addr);
        const isAuthorizedCheck = await registry.isAuthorizedIssuer(addr);
        console.log("   Is Admin:", isAdminCheck);
        console.log("   Is Authorized Issuer:", isAuthorizedCheck);

        // Try to get institution details (might fail if not registered)
        try {
          const institution = await registry.getInstitution(addr);
          if (institution.name !== "") {
            console.log("   Institution Name:", institution.name);
            console.log("   Is Verified:", institution.verified);
          } else {
            console.log("   No institution registered for this address");
          }
        } catch (error) {
          console.log("   Error getting institution:", error.message);
        }
      }
    }

    // 8. Contract interaction capabilities
    console.log("\n=== AVAILABLE FUNCTIONS ===");
    console.log("📚 Read Functions:");
    console.log("   - getInstitution(address)");
    console.log("   - getAllIssuers()");
    console.log("   - getVerifiedInstitutionsCount()");
    console.log("   - isAuthorizedIssuer(address)");
    console.log("   - isAdmin(address)");
    console.log("   - getInstitutionStats(address)");
    console.log("   - owner()");

    if (isAdmin) {
      console.log("🔧 Write Functions (you have admin access):");
      console.log("   - registerInstitution(address, name, website, email, documentHash)");
      console.log("   - verifyInstitution(address)");
      console.log("   - revokeInstitution(address)");
      console.log("   - updateInstitutionInfo(address, name, website, email)");
      console.log("   - updateInstitutionDocuments(address, documentHash)");
      
      if (deployer.address === owner) {
        console.log("👑 Owner Functions:");
        console.log("   - addAdmin(address)");
        console.log("   - removeAdmin(address)");
      }
    }

  } catch (error) {
    console.error("❌ Error exploring contract:", error);
  }
}

// Example function to demonstrate how to interact with the contract
async function exampleInteractions() {
  console.log("\n\n🎯 EXAMPLE INTERACTIONS");
  console.log("========================");

  const registryAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const registry = CredentialRegistry.attach(registryAddress);

  console.log("\n// Get contract instance");
  console.log(`const registry = await ethers.getContractAt("CredentialRegistry", "${registryAddress}");`);

  console.log("\n// Check if address is authorized issuer");
  console.log(`const isAuthorized = await registry.isAuthorizedIssuer("0x742d35Cc6634C0532925a3b8d93B72e6cc33b16d");`);

  console.log("\n// Get all issuers");
  console.log(`const allIssuers = await registry.getAllIssuers();`);

  console.log("\n// Get institution details");
  console.log(`const institution = await registry.getInstitution("0x742d35Cc6634C0532925a3b8d93B72e6cc33b16d");`);

  console.log("\n// Register new institution (admin only)");
  console.log(`await registry.registerInstitution(`);
  console.log(`  "0x742d35Cc6634C0532925a3b8d93B72e6cc33b16d",`);
  console.log(`  "Example University",`);
  console.log(`  "https://example.edu",`);
  console.log(`  "contact@example.edu",`);
  console.log(`  "QmExampleIPFSHash"`);
  console.log(`);`);

  console.log("\n// Verify institution (admin only)");
  console.log(`await registry.verifyInstitution("0x742d35Cc6634C0532925a3b8d93B72e6cc33b16d");`);
}

// Run the main function
main()
  .then(() => exampleInteractions())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
