const { ethers } = require("hardhat");
const deployment = require("../../frontend/src/lib/contract/address.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  const dcms = await ethers.getContractAt("DCMS", deployment.address);
  const admin = await dcms.admin();
  console.log("Contract address:", deployment.address);
  console.log("Contract admin:", admin);
  console.log("Current Hardhat signer:", deployer.address);
  console.log("Signer is admin:", admin.toLowerCase() === deployer.address.toLowerCase());
}

main().catch(console.error);
