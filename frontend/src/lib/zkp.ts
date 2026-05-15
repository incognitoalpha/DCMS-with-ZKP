import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";

let poseidonInstance: any = null;

export async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const p = await getPoseidon();
  const hash = p(inputs);
  return BigInt(p.F.toString(hash));
}

export async function generateIdentityCommitment(
  identityTrapdoor: bigint,
  identityNullifier: bigint
): Promise<bigint> {
  return await poseidonHash([identityTrapdoor, identityNullifier]);
}

export async function generateVotingNullifier(
  identityNullifier: bigint,
  proposalId: bigint,
  secret: bigint
): Promise<bigint> {
  return await poseidonHash([identityNullifier, proposalId, secret]);
}

export async function generateBookingCommitment(
  secret: bigint,
  resourceId: bigint,
  startTime: bigint,
  endTime: bigint,
  nonce: bigint
): Promise<bigint> {
  return await poseidonHash([secret, resourceId, startTime, endTime, nonce]);
}

export async function generateBookingNullifier(
  secret: bigint,
  nonce: bigint
): Promise<bigint> {
  return await poseidonHash([secret, nonce]);
}

export async function generateReputationCommitment(
  secret: bigint,
  score: bigint
): Promise<bigint> {
  return await poseidonHash([secret, score]);
}

export interface ZKProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  publicSignals: bigint[];
}

export async function generateVotingProof(
  proposalId: bigint,
  identityTrapdoor: bigint,
  identityNullifier: bigint,
  secret: bigint,
  scope: bigint
): Promise<ZKProof> {
  const nullifierHash = await generateVotingNullifier(identityNullifier, proposalId, secret);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      proposalId,
      nullifierHash,
      scope,
      identityTrapdoor,
      identityNullifier,
      secret,
    },
    "/zk/voting.wasm",
    "/zk/voting_final.zkey"
  );
  return formatSnarkjsProof(proof, publicSignals);
}

export async function generateBookingProof(
  secret: bigint,
  resourceId: bigint,
  startTime: bigint,
  endTime: bigint,
  nonce: bigint
): Promise<ZKProof> {
  const commitment = await generateBookingCommitment(secret, resourceId, startTime, endTime, nonce);
  const nullifier = await generateBookingNullifier(secret, nonce);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      commitment,
      nullifier,
      secret,
      resourceId,
      startTime,
      endTime,
      bookingNonce: nonce,
    },
    "/zk/booking.wasm",
    "/zk/booking_final.zkey"
  );
  return formatSnarkjsProof(proof, publicSignals);
}

export async function generateReputationProof(
  secret: bigint,
  score: bigint,
  threshold: bigint
): Promise<ZKProof> {
  const commitment = await generateReputationCommitment(secret, score);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      threshold,
      commitment,
      secret,
      score,
    },
    "/zk/reputation.wasm",
    "/zk/reputation_final.zkey"
  );
  return formatSnarkjsProof(proof, publicSignals);
}

function formatSnarkjsProof(proof: any, publicSignals: any[]): ZKProof {
  return {
    a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
    b: [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ],
    c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
    publicSignals: publicSignals.map((x: any) => BigInt(x)),
  };
}

export function formatProofForContract(proof: ZKProof): any[] {
  return [
    proof.a,
    proof.b,
    proof.c
  ];
}

export function generateRandomSecret(): bigint {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex);
}

export function storeZKPIdentity(identity: {
  trapdoor: bigint;
  nullifier: bigint;
  commitment: bigint;
}) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dcms_zkp_identity', JSON.stringify({
      trapdoor: identity.trapdoor.toString(),
      nullifier: identity.nullifier.toString(),
      commitment: identity.commitment.toString()
    }));
  }
}

export function getZKPIdentity(): { trapdoor: bigint; nullifier: bigint; commitment: bigint } | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('dcms_zkp_identity');
  if (!stored) return null;
  const data = JSON.parse(stored);
  return {
    trapdoor: BigInt(data.trapdoor),
    nullifier: BigInt(data.nullifier),
    commitment: BigInt(data.commitment)
  };
}

export function hasStoredIdentity(): boolean {
  return getZKPIdentity() !== null;
}

export function clearZKPIdentity() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('dcms_zkp_identity');
  }
}
