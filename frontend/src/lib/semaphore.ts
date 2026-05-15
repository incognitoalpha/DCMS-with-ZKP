import { generateRandomSecret, generateIdentityCommitment, getZKPIdentity, generateVotingNullifier } from './zkp';

export interface SemaphoreIdentity {
  trapdoor: bigint;
  nullifier: bigint;
  commitment: bigint;
}

export async function createSemaphoreIdentity(): Promise<SemaphoreIdentity> {
  const trapdoor = generateRandomSecret();
  const nullifier = generateRandomSecret();
  const commitment = await generateIdentityCommitment(trapdoor, nullifier);

  return { trapdoor, nullifier, commitment };
}

export async function getOrCreateIdentity(): Promise<SemaphoreIdentity> {
  const existing = getZKPIdentity();
  if (existing) return existing;
  return await createSemaphoreIdentity();
}

export function hasIdentity(): boolean {
  return getZKPIdentity() !== null;
}

export function getIdentityCommitment(): bigint | null {
  const identity = getZKPIdentity();
  return identity?.commitment ?? null;
}

export interface MerkleProof {
  pathElements: bigint[];
  pathIndices: number[];
  root: bigint;
}

export async function generateMerkleProof(
  leafIndex: number,
  treeDepth: number = 16
): Promise<MerkleProof> {
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];

  for (let i = 0; i < treeDepth; i++) {
    pathElements.push(BigInt(Math.floor(Math.random() * 1000000)));
    pathIndices.push(leafIndex % 2);
    leafIndex = Math.floor(leafIndex / 2);
  }

  const identity = getZKPIdentity();
  const root = identity?.commitment ?? BigInt(0);

  return { pathElements, pathIndices, root };
}

export interface VotingSignals {
  proposalId: bigint;
  nullifierHash: bigint;
  scope: bigint;
}

export async function prepareVotingSignals(
  proposalId: bigint,
  identity: SemaphoreIdentity,
  secret: bigint,
  treeRoot: bigint
): Promise<VotingSignals> {
  const nullifierHash = await generateVotingNullifier(
    identity.nullifier,
    proposalId,
    secret
  );

  return {
    proposalId,
    nullifierHash,
    scope: treeRoot
  };
}

export function getIdentityNullifier(): bigint | null {
  const identity = getZKPIdentity();
  return identity?.nullifier ?? null;
}

export function getIdentityTrapdoor(): bigint | null {
  const identity = getZKPIdentity();
  return identity?.trapdoor ?? null;
}
