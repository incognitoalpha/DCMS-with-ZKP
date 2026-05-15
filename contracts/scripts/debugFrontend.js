const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const user = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  // Load the ABI from frontend
  const artifact = JSON.parse(fs.readFileSync("../frontend/src/lib/contract/DCMS.json", "utf8"));

  // Connect to Hardhat node
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const wallet = new ethers.Wallet("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", provider);
  const contract = new ethers.Contract(address, artifact.abi, wallet);

  console.log("Connected as:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)));

  try {
    const bookings = await contract.getMyBookings();
    console.log("getMyBookings() returned:", bookings.length, "bookings");
    console.log(JSON.stringify(bookings, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  } catch (e) {
    console.log("Error calling getMyBookings():", e.message);
  }
}

main().catch(console.error);