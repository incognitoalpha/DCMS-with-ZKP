# DCMS — Decentralized Cottage Management System

A blockchain dApp for booking shared cottage resources, built for a B.Tech final-year project.

Core features (from the PRD): wallet authentication, admin resource management, booking with no double-booking, on-chain history, one-wallet-one-vote governance.

Novelty features added on top:

1. **Soulbound NFT booking receipts (ERC-5192)** — every booking auto-mints a non-transferable ERC-721 NFT to the booker. Metadata + SVG art are generated entirely on-chain (no IPFS, no off-chain server). Cancellation burns the NFT.
2. **Dynamic surge pricing** — the contract computes utilization across the next 7-day window and quotes a multiplier from 1.0× up to 2.5×. Frontend shows the live surge multiplier per resource.
3. **On-chain reputation** — every completed booking can be claimed for one permanent reputation point, written to the chain. Visible on the bookings page.
4. **Live event feed** — the activity page subscribes directly to contract events with `ethers.Contract.on(...)` so bookings, votes and refunds appear in real time.

---

## Stack

| Layer | Tech |
|---|---|
| Smart contracts | Solidity 0.8.24, OpenZeppelin (ERC-721, Base64) |
| Dev / test | Hardhat 2.x |
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS, custom cottage theme |
| Web3 | ethers.js v6 |
| Wallet | MetaMask |

---

## Project layout

```
blockchain_el/
├── contracts/                Hardhat project
│   ├── contracts/DCMS.sol    Main contract
│   ├── test/DCMS.test.js     15 unit tests
│   ├── scripts/deploy.js     Deploys + seeds resources + writes ABI to frontend
│   └── hardhat.config.js
└── frontend/                 Next.js app
    └── src/
        ├── app/              App Router pages (home, resources, bookings, governance, admin, activity)
        ├── components/       Navbar, Toast
        └── lib/
            ├── wallet.tsx    React context for MetaMask + ethers
            ├── format.ts     Helpers (eth, time, revert reasons)
            └── contract/     Auto-generated ABI + address (written by deploy.js)
```

---

## Quick start (local Hardhat chain)

You need Node 18+ and MetaMask installed in your browser.

### 1. Install dependencies

```bash
cd contracts && npm install
cd ../frontend && npm install
```

### 2. Start a local Hardhat chain

In one terminal, from `contracts/`:

```bash
npx hardhat node
```

This prints 20 funded accounts. Account #0 is the **deployer/admin**.

### 3. Deploy the contract + seed resources

In a second terminal, from `contracts/`:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This deploys the contract to your local chain, seeds 4 sample resources
(Lakeview Cabin, Forest Lodge, Bonfire Pit, Sauna House), and writes the ABI
and deployed address into `frontend/src/lib/contract/`. The frontend imports
those files directly, so no env vars are needed.

### 4. Run the frontend

From `frontend/`:

```bash
npm run dev
```

Open http://localhost:3000.

> If port 3000 is already in use, run `npm run dev -- -p 3001`.

### 5. Configure MetaMask

Add a custom network in MetaMask:

| Field | Value |
|---|---|
| Network name | DCMS Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | ETH |

Then import a Hardhat account using one of the private keys printed by
`npx hardhat node`. Account #0 will be admin (it deployed the contract);
import #1, #2 etc. as regular users.

> **Important**: every time you stop and restart `npx hardhat node`, the
> chain resets. You'll need to redeploy (step 3) and reset MetaMask's
> activity for the test account: `Settings → Advanced → Clear activity tab data`.

---

## Demo script (5 minutes)

1. **Open the home page** with admin wallet (account #0). Show the wallet card showing role = admin.
2. **Resources page** — point out the 4 seeded resources with surge price chip.
3. **Switch to a user wallet** (account #1). Book the Lakeview Cabin for 2 hours.
4. Open MetaMask → NFTs tab → see the **soulbound booking receipt NFT** with on-chain SVG.
5. Open the **Activity** page — point out the live booking event that just appeared.
6. Make a long booking (e.g. 3 days) on the same resource → surge multiplier visibly increases on the resources page.
7. Try to book the same slot from another wallet → the contract reverts with `time slot already booked`.
8. Cancel a booking → see refund + NFT burn event on Activity.
9. **Governance page** — submit a proposal "Add a hot tub", vote yes from two different wallets.
10. After voting deadline, click **Execute result** to finalize on-chain.
11. After a booking ends, click **Claim +1 reputation** to bump the on-chain reputation score.

---

## Running the test suite

From `contracts/`:

```bash
npx hardhat test
```

15 unit tests covering: admin-only addResource, double-booking prevention,
back-to-back bookings, refund-on-cancel, ERC-5192 soulbound enforcement,
tokenURI metadata, surge multiplier scaling, reputation idempotency, and
proposal voting + execution.

---

## Deploying to Sepolia testnet (optional)

1. Get a Sepolia RPC URL (Alchemy / Infura / public RPC).
2. Set environment variables:

   ```bash
   export SEPOLIA_RPC_URL=https://...
   export PRIVATE_KEY=0xyourkey...
   ```

3. Deploy:

   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

4. Update MetaMask to Sepolia. The `address.json` and `DCMS.json` written
   into the frontend will now point at the Sepolia deployment.

---

## What is on-chain vs off-chain

| Data | Where |
|---|---|
| Resources, bookings, proposals, votes, reputation | On-chain (contract state) |
| NFT image (SVG) and metadata JSON | On-chain (returned from `tokenURI` as base64) |
| User profile / private data | Not stored anywhere — wallet address is identity |

There is no backend, no database, no IPFS pin. The Next.js app is a
fully static frontend talking directly to the contract.

---

## Security notes

- Admin-only functions are gated by `onlyAdmin` modifier.
- Booking conflict detection is on-chain (loop over existing bookings of the resource).
- Cancellation refunds via `call{value:}` with `require(ok)` to surface failures.
- Soulbound enforcement uses ERC-5192's `Locked(tokenId)` event and overrides `_update`, `approve`, `setApprovalForAll`.
- Re-entrancy: state changes happen before the external `.call` for refunds; no untrusted callbacks during booking.

---

## Future scope (from the PRD)

- ZKP for booking privacy
- DAO-based anonymous governance
- ERC-20 token-based payments
- IPFS for richer resource imagery
- Mobile / wallet-deeplink flow
