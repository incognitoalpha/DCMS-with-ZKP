const { ethers, network, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId: ${network.config.chainId})`);

  const DCMS = await ethers.getContractFactory("DCMS");
  const dcms = await DCMS.deploy();
  await dcms.waitForDeployment();
  const address = await dcms.getAddress();
  console.log(`DCMS deployed at: ${address}`);

  const VotingVerifier = await ethers.getContractFactory("VotingVerifier");
  const votingVerifier = await VotingVerifier.deploy();
  await votingVerifier.waitForDeployment();
  
  const BookingVerifier = await ethers.getContractFactory("BookingVerifier");
  const bookingVerifier = await BookingVerifier.deploy();
  await bookingVerifier.waitForDeployment();
  
  const ReputationVerifier = await ethers.getContractFactory("ReputationVerifier");
  const reputationVerifier = await ReputationVerifier.deploy();
  await reputationVerifier.waitForDeployment();
  
  const txSet = await dcms.setVerifiers(
    await votingVerifier.getAddress(),
    await bookingVerifier.getAddress(),
    await reputationVerifier.getAddress()
  );
  await txSet.wait();
  console.log("Verifiers deployed and set in DCMS");

  // Seed a few sample resources so the demo has something to show.
  const seed = [
    ["Lakeview Cabin", "Two-bed cabin facing the lake", ethers.parseEther("0.01")],
    ["Forest Lodge", "Six-bed lodge in the pine grove", ethers.parseEther("0.02")],
    ["Bonfire Pit", "Outdoor fire pit, 10 seats", ethers.parseEther("0.001")],
    ["Sauna House", "Wood-fired sauna, fits 6", ethers.parseEther("0.005")],
  ];

  for (const [name, desc, price] of seed) {
    const tx = await dcms.addResource(name, desc, price);
    await tx.wait();
    console.log(`  + seeded resource: ${name}`);
  }

  // Write the address + ABI into the frontend so it just works.
  const frontendDir = path.resolve(__dirname, "..", "..", "frontend");
  const outDir = path.join(frontendDir, "src", "lib", "contract");
  fs.mkdirSync(outDir, { recursive: true });

  const artifact = await artifacts.readArtifact("DCMS");
  fs.writeFileSync(
    path.join(outDir, "DCMS.json"),
    JSON.stringify({ abi: artifact.abi }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "address.json"),
    JSON.stringify(
      {
        address,
        chainId: Number(network.config.chainId),
        network: network.name,
      },
      null,
      2
    )
  );

  console.log(`Wrote ABI + address to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
