# DCMS - Zero-Knowledge Proof Implementation Guide

## Project Overview

DCMS (Decentralized Cottage Management System) is a final-year blockchain project featuring Zero-Knowledge Proofs (ZKP) for privacy-preserving bookings and governance.

**Theme**: Application novelty — using ZKP in a shared resource booking domain (cottage/vacation rentals).

---

## ZKP Architecture

### Dual-Mode System

The project implements a **dual-mode architecture** allowing both plaintext and ZKP-based bookings to coexist:

```
┌─────────────────────────────────────────────────────┐
│                  Frontend                           │
├─────────────────────────────────────────────────────┤
│  User connects wallet                               │
│         ↓                                           │
│  Check: Does user have ZKP identity?               │
│         ↓                                           │
│  YES → Use ZKP booking flow (private)              │
│  NO  → Use plaintext booking (fallback)            │
└─────────────────────────────────────────────────────┘
```

### Why Dual-Mode?

- Progressive rollout capability
- Debugging and comparison
- Demo flexibility for presentations
- Safety net during development
- Examiners can verify both implementations

---

## Phase Implementation

### Phase 1: Anonymous Governance (Semaphore)
**Goal**: Vote on proposals without revealing wallet addresses

**Implementation**:
1. Users generate Semaphore Identity (secret off-chain)
2. Register identity commitment to Merkle tree on-chain
3. Generate ZK proof: "I am part of the group, haven't voted on this proposal"
4. Contract verifies Semaphore proof instead of tracking `msg.sender`

**Verification**: Votes increment correctly, double-voting prevented via nullifier, voter address cannot be derived

### Phase 2: Private Bookings
**Goal**: Hide booker identity and booking details while preventing double-booking

**Implementation**:
1. Bookings stored as cryptographic commitments: `hash(userSecret, resourceId, startTime, endTime)`
2. Double-booking prevented via nullifier: `hash(bookingSecret)`
3. On-chain only shows random commitment hashes
4. Frontend generates ZK proof for every booking

**Verification**: No two users can book same slot, block explorers only show random hashes

### Phase 3: Private Reputation
**Goal**: Prove reputation thresholds without revealing exact score

**Implementation**:
1. Users submit commitment to new score when claiming
2. Circom circuit proves `secret_score > threshold` without revealing score
3. Contract verifies threshold proof before granting premium features

**Verification**: User with score 5 can prove "> 3" threshold without revealing actual score

---

## File Structure

### Smart Contracts

| File | Purpose |
|------|---------|
| `contracts/contracts/DCMS.sol` | Main contract — resources, bookings (both modes), governance, reputation |
| `contracts/contracts/SemaphoreVerifier.sol` | Semaphore protocol integration for anonymous voting |
| `contracts/contracts/BookingVerifier.sol` | PLONK verifier for private bookings |
| `contracts/contracts/MerkleTree.sol` | On-chain Merkle tree for identity commitments |

### ZK Circuits

| File | Purpose |
|------|---------|
| `contracts/circuits/booking.circom` | Private booking circuit — proves valid booking without revealing details |
| `contracts/circuits/voting.circom` | Anonymous voting circuit — proves group membership + nullifier |
| `contracts/circuits/reputation.circom` | Reputation threshold circuit — proves score > threshold |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/lib/wallet.tsx` | Wallet connection (unchanged) |
| `frontend/src/lib/zkp.ts` | ZKP proof generation (NEW) |
| `frontend/src/lib/semaphore.ts` | Semaphore identity management (NEW) |
| `frontend/src/app/bookings/page.tsx` | Booking UI — auto-detects ZKP mode |
| `frontend/src/app/governance/page.tsx` | Governance UI — anonymous voting |

---

## Dependencies

### New Dependencies

**Contracts**:
```json
{
  "circom": "^0.5.0",
  "snarkjs": "^0.7.0",
  "@semaphore-protocol/contracts": "^3.0.0"
}
```

**Frontend**:
```json
{
  "snarkjs": "^0.7.0"
}
```

### Existing Dependencies (Unchanged)

- Hardhat, OpenZeppelin contracts (contracts)
- Next.js 14, React 18, ethers.js 6, Tailwind CSS (frontend)

---

## Key Technologies

| Technology | Purpose |
|------------|---------|
| **Circom** | Domain-specific language for ZK circuits |
| **SnarkJS** | Generate ZK proofs in browser (WASM) |
| **Semaphore Protocol** | Anonymous identity and voting |
| **PLONK** | ZK-SNARK scheme used |

---

## Switching Between Modes

### Automatic Detection
```typescript
async function handleBook(resourceId, startTime, endTime) {
  const hasIdentity = await checkZKPIdentity(walletAddress);

  if (hasIdentity) {
    // Use ZKP path
    const { commitment, nullifier, proof } = await generateZKPBooking(
      userSecret, resourceId, startTime, endTime
    );
    await contract.bookResourceZKP(commitment, nullifier, resourceId, startTime, endTime, proof);
  } else {
    // Use plaintext path (backwards compatible)
    await contract.bookResource(resourceId, startTime, endTime);
  }
}
```

### Manual Toggle
- Add "Use Privacy Mode" checkbox in UI
- Users can opt-in to ZKP mode

---

## Contract Function Signatures

### Existing (Unchanged)

```solidity
function bookResource(uint256 resourceId, uint256 startTime, uint256 endTime) external payable;

function vote(uint256 proposalId, bool support) external;

function claimReputation(uint256 bookingId) external;
```

### New (ZKP)

```solidity
function registerIdentity(bytes32 identityCommitment) external;

function bookResourceZKP(
    bytes32 commitment,
    bytes32 nullifier,
    uint256 resourceId,
    uint256 startTime,
    uint256 endTime,
    uint256[8] proof
) external payable;

function voteZKP(
    uint256 proposalId,
    bool support,
    bytes32 nullifier,
    uint256[8] proof
) external;
```

---

## Testing Strategy

1. **Unit tests** in Hardhat for contract functions
2. **Circuit tests** using circom test vectors
3. **Integration tests**: ZKP flow end-to-end locally
4. **Testnet deployment**: Sepolia or Polygon Amoy

---

## Important Notes

- Phase 1 (surge pricing ZKP) was skipped — current implementation is already efficient
- Focus on Phases 2-4 (Anonymous Governance, Private Reputation, Confidential Bookings)
- All ZK-related errors in UI should show user-friendly messages with actionable next steps
- Privacy Shield icon displayed on all ZKP-protected actions

---

## References

- [Circom Documentation](https://docs.circom.io)
- [SnarkJS Documentation](https://github.com/iden3/snarkjs)
- [Semaphore Protocol](https://semaphore.appliedzkp.org)
- [PLONK Paper](https://eprint.iacr.org/2019/953)