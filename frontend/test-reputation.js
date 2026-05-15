const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const path = require("path");

async function test() {
  const poseidon = await buildPoseidon();
  const secret = 123456789n;
  const score = 1n;
  
  const hash = poseidon([secret, score]);
  const commitment = poseidon.F.toString(hash);

  console.log("Expected commitment:", commitment);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      threshold: 1,
      commitment: commitment,
      secret: secret,
      score: score,
    },
    path.join(__dirname, "public/zk/reputation.wasm"),
    path.join(__dirname, "public/zk/reputation_final.zkey")
  );

  console.log("Public Signals:", publicSignals);
}

test().catch(console.error);