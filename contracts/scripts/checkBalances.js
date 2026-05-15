const { ethers } = require("hardhat");

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  const adminAddr = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const userAddr = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

  const adminBal = await provider.getBalance(adminAddr);
  const userBal = await provider.getBalance(userAddr);

  console.log("Admin balance:", ethers.formatEther(adminBal), "ETH");
  console.log("User balance:", ethers.formatEther(userBal), "ETH");
}

main().catch(console.error);