const { ethers } = require("hardhat");
const deployment = require("../../frontend/src/lib/contract/address.json");

async function main() {
  const address = deployment.address;
  const dcms = await ethers.getContractAt("DCMS", address);
  console.log("contract:", address);

  // Try admin()
  try {
    const admin = await dcms.admin();
    console.log("admin():", admin);
  } catch (e) {
    console.log("admin() error:", e.message);
  }

  // Try getAllResources()
  try {
    const resources = await dcms.getAllResources();
    console.log("getAllResources():", resources.length, "resources");
  } catch (e) {
    console.log("getAllResources() error:", e.message);
  }
}

main().catch(console.error);
