const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("../../frontend/node_modules/circomlibjs");
const path = require("path");

async function main() {
  const poseidon = await buildPoseidon();
  const secret = 123456789n;
  const score = 1n;
  
  const hash = poseidon([secret, score]);
  const repCommitment = BigInt(poseidon.F.toString(hash));

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      threshold: 1,
      commitment: repCommitment,
      secret: secret,
      score: score,
    },
    path.join(__dirname, "../../frontend/public/zk/reputation.wasm"),
    path.join(__dirname, "../../frontend/public/zk/reputation_final.zkey")
  );

  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
  const c = [proof.pi_c[0], proof.pi_c[1]];

  const dcmsAddress = require("../../frontend/src/lib/contract/address.json").address;
  const DCMS = await ethers.getContractFactory("DCMS");
  const dcms = DCMS.attach(dcmsAddress);

  console.log("Calling claimReputation...");
  try {
    const tx = await dcms.claimReputation(1n, repCommitment, a, b, c);
    const receipt = await tx.wait();
    console.log("Success! Hash:", receipt.hash);
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

main().catch(console.error);