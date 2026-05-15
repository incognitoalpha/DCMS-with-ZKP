const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("../../frontend/node_modules/circomlibjs");
const path = require("path");

async function main() {
  const poseidon = await buildPoseidon();
  const secret = 123456789n;
  const score = 1n;
  
  const hash = poseidon([secret, score]);
  const commitment = BigInt(poseidon.F.toString(hash));

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      threshold: 1,
      commitment: commitment,
      secret: secret,
      score: score,
    },
    path.join(__dirname, "../../frontend/public/zk/reputation.wasm"),
    path.join(__dirname, "../../frontend/public/zk/reputation_final.zkey")
  );

  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
  const c = [proof.pi_c[0], proof.pi_c[1]];

  console.log("Public Signals:", publicSignals);
  console.log("Expected input array:", [publicSignals[0], publicSignals[1]]);

  const ReputationVerifier = await ethers.getContractFactory("ReputationVerifier");
  const verifier = await ReputationVerifier.deploy();
  await verifier.waitForDeployment();

  const isValid = await verifier.verifyProof(a, b, c, [publicSignals[0], publicSignals[1]]);
  console.log("Verifier returned:", isValid);
  
  const isValidReversed = await verifier.verifyProof(a, b, c, [publicSignals[1], publicSignals[0]]);
  console.log("Verifier returned (reversed):", isValidReversed);
}

main().catch(console.error);