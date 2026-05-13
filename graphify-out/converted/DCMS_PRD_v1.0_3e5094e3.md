<!-- converted from DCMS_PRD_v1.0.docx -->


PRODUCT REQUIREMENTS DOCUMENT
Decentralized & Privacy-Preserving Cottage Management System (DCMS)



# Table of Contents

# 1. Executive Summary
The Decentralized and Privacy-Preserving Cottage Management System (DCMS) is a next-generation platform designed to address the fundamental shortcomings of centralized cottage management tools. By building atop ZKBase — a ZK-Rollup Layer 2 scaling solution anchored to the Ethereum mainnet — DCMS delivers a tamper-proof, scalable, and privacy-first ecosystem for shared cottage environments.
DCMS enables cottage communities (families, co-operatives, fractional ownership groups, vacation clubs) to manage bookings, govern shared resources, track maintenance, and authenticate users without exposing sensitive personal or transactional data. Zero-Knowledge Proofs (ZKPs) are the cornerstone privacy mechanism: they allow the system to verify facts (e.g., a user is a dues-paying member) without disclosing the underlying data.
This document defines the complete product requirements — spanning user personas, functional specifications, non-functional constraints, smart contract architecture, ZKP integration, front-end design, security model, and project roadmap — serving as the single source of truth for all engineering and design stakeholders.


# 2. Background & Problem Statement
## 2.1 Current Landscape
Shared vacation and cottage properties are managed through a fragmented mix of spreadsheets, group chats, centralized booking platforms (e.g., Airbnb, VRBO), and paper-based logs. These approaches suffer from:
- Single points of failure: A central server going down can halt all operations.
- Opacity: Members cannot independently audit transaction histories, booking logs, or financial decisions.
- Privacy violations: Centralized platforms harvest, store, and sometimes sell user data.
- Trust deficits: Disputes over bookings, payments, and governance are common due to lack of verifiable, immutable records.
- High fees: Payment processors and intermediary platforms typically charge 3-15% transaction fees.

## 2.2 Why Blockchain + ZKPs?
A blockchain-based approach replaces the central authority with a transparent, immutable ledger enforced by consensus. Zero-Knowledge Proofs add a critical privacy layer: on a public blockchain, all data is visible to all participants by default, which is unacceptable for sensitive booking and identity data. ZKPs resolve this paradox — the system can prove the validity of a state transition without revealing the state itself.

## 2.3 Why ZKBase (Layer 2)?
Deploying directly on Ethereum Layer 1 introduces prohibitive gas costs and throughput bottlenecks (~15 TPS). ZKBase's ZK-Rollup infrastructure bundles thousands of off-chain transactions into a single on-chain proof, achieving:
- Throughput: Up to thousands of transactions per second off-chain.
- Cost reduction: Gas fees reduced by orders of magnitude versus L1.
- Security: Cryptographic validity guaranteed by ZKPs settled on Ethereum.
- Privacy: PLONK-based ZKPs enable private, verifiable computation.

# 3. Goals & Non-Goals
## 3.1 Product Goals
- Deliver a fully functional dApp prototype for cottage community management.
- Implement ZKP-based privacy for identity, bookings, and governance.
- Demonstrate ZKBase's PLONK algorithm in real-world smart contract interactions.
- Provide a reference implementation of DAO-based community governance with anonymous voting.
- Achieve sub-second proof verification on supported hardware for all user-facing operations.
- Ensure the system is auditable (all state transitions verifiable) without exposing private data.
- Serve as an exemplary portfolio and curriculum project for blockchain engineering education.

## 3.2 Non-Goals (v1.0)
- DCMS v1.0 is NOT a production-deployed commercial SaaS product.
- Live IoT hardware integration (smart locks, sensors) is a future milestone.
- Cross-chain bridge functionality is out of scope for v1.0.
- Mobile native applications (iOS/Android) are not part of v1.0.
- Full legal compliance tooling (KYC/AML) is not included.
- A production-grade prover network — a single prover node is sufficient for prototype.

# 4. User Personas
## 4.1 Persona Overview

## 4.2 Detailed Persona Profiles
### 4.2.1 Alex — The Owner
- Demographics: 35-60, property co-owner, limited blockchain experience.
- Pain Points: Disputes over booking slots, opaque financial splits, fear of data leaks.
- Goals: Transparent usage logs, fair revenue distribution, verifiable expense tracking.
- Success Metric: Can book, pay, and view usage history without contacting an admin.

### 4.2.2 Sam — The Guest
- Demographics: 20-50, invited guest, no crypto experience expected.
- Pain Points: Complex wallet setup, confusing gas fees, uncertainty about booking confirmation.
- Goals: Simple booking flow, instant confirmation, privacy of stay dates.
- Success Metric: Completes a booking end-to-end in under 5 minutes.

### 4.2.3 Jordan — The Admin
- Demographics: Elected community role, moderate technical comfort.
- Pain Points: Manual member management, lack of audit trail for governance decisions.
- Goals: Trustless member onboarding, transparent DAO votes, automated enforcement of rules.
- Success Metric: Can onboard a new member and process a governance proposal without developer intervention.

### 4.2.4 Morgan — The Maintainer
- Demographics: Contractor / handyman, very low crypto familiarity.
- Pain Points: Getting paid on time, ambiguous task specifications, proof-of-work disputes.
- Goals: Clear task list, verifiable completion record, timely payment release.
- Success Metric: Logs a completed task and triggers automated payment via smart contract.

### 4.2.5 Casey — The Developer
- Demographics: Software engineer, strong blockchain and cryptography background.
- Pain Points: Lack of documentation, opaque ZKP integration, poor local dev tooling.
- Goals: Clean contract ABIs, reproducible ZK circuit builds, comprehensive test coverage.
- Success Metric: Can fork, extend, and redeploy the system with a new ZKP circuit in under 1 day.


# 5. Functional Requirements
## 5.1 Module 1 — Decentralized Identity (DID) & Access Control
### 5.1.1 User Registration & DID Creation
- FR-1.1: The system SHALL allow any Ethereum-compatible wallet holder to register as a user by submitting a DID creation transaction to the IdentityRegistry smart contract.
- FR-1.2: DIDs SHALL conform to the W3C DID Core Specification (did:zkbase:<identifier> method).
- FR-1.3: The registration transaction SHALL NOT expose personal information on-chain; only a cryptographic commitment to user attributes is stored.
- FR-1.4: Upon successful registration, the system SHALL emit a DIDRegistered event containing the DID and a Merkle root of the user's attribute commitments.
- FR-1.5: Users SHALL be able to update their attribute commitments (e.g., renew membership) by submitting a new commitment with a ZKP proving continuity.

### 5.1.2 Role-Based Access Control (RBAC)
- FR-1.6: The system SHALL define four roles: OWNER, GUEST, ADMIN, MAINTAINER.
- FR-1.7: Role assignments SHALL be stored on-chain in the IdentityRegistry and enforced by all downstream contracts via modifiers.
- FR-1.8: ADMINs SHALL be able to grant and revoke roles via governance proposal or direct admin action (configurable per deployment).
- FR-1.9: Role transitions SHALL emit RoleGranted and RoleRevoked events for audit purposes.
- FR-1.10: A ZKP SHALL be used to prove role membership in off-chain interactions (e.g., accessing a locked resource) without exposing the on-chain identity link.

### 5.1.3 ZKP-Based Authentication
- FR-1.11: The system SHALL implement a PLONK-based ZKP circuit (MembershipProof) that proves: (a) the user holds a valid DID, (b) the DID has a specific role, and (c) the membership is not expired.
- FR-1.12: Authentication flows SHALL accept a ZKP proof + public inputs (nullifier hash, role, expiry block) and verify on-chain via the VerifierContract.
- FR-1.13: Nullifiers SHALL be stored on-chain post-authentication to prevent replay attacks.
- FR-1.14: Failed verification attempts SHALL be logged on-chain with a timestamp (but without revealing the prover identity).

## 5.2 Module 2 — Secure Booking & Resource Management
### 5.2.1 Resource Registry
- FR-2.1: ADMINs SHALL be able to register cottage resources (rooms, equipment, vehicles, common areas) with name, capacity, booking unit (hourly/daily), and pricing.
- FR-2.2: Resources SHALL have a status: AVAILABLE, OCCUPIED, MAINTENANCE, RETIRED.
- FR-2.3: Resource metadata (descriptions, images) SHALL be stored off-chain on IPFS, with the IPFS CID committed on-chain.

### 5.2.2 Private Booking System
- FR-2.4: Users SHALL be able to submit a booking request by providing a ZKP proving: (a) they hold a valid membership, (b) the requested time slot is free, and (c) they have sufficient balance.
- FR-2.5: The booking proof SHALL NOT reveal the user's identity or exact time slot details to uninvolved parties — only the resource occupancy state is updated publicly.
- FR-2.6: The ResourceBooking contract SHALL maintain an encrypted booking registry where each entry is: {resource_id, commitment_hash, start_block, end_block, payment_escrow_address}.
- FR-2.7: Double-booking prevention SHALL be enforced by a Merkle tree of active booking commitments, verified on-chain during each new booking.
- FR-2.8: Users SHALL receive an off-chain booking receipt (signed by the Layer 2 server) containing their full booking details, encrypted with their public key.
- FR-2.9: Users SHALL be able to cancel a booking up to 24 hours before start time; cancellation SHALL trigger automated partial or full refund per the configured cancellation policy.

### 5.2.3 Payment Processing
- FR-2.10: Payments SHALL be processed via ZKBase's native token transfer mechanism, denominated in ETH or a designated ERC-20 stablecoin.
- FR-2.11: Booking fees SHALL be held in escrow by the ResourceBooking contract until the booking end time, then released to the resource pool.
- FR-2.12: The system SHALL support shared expense splitting — e.g., maintenance costs allocated pro-rata across owners.
- FR-2.13: All payment events SHALL emit on-chain logs: PaymentReceived, EscrowReleased, RefundIssued.

## 5.3 Module 3 — Community Governance (DAO)
### 5.3.1 Proposal Lifecycle
- FR-3.1: Any member with OWNER role SHALL be able to submit a governance proposal containing: title, description, proposal type (SPENDING, RULE_CHANGE, MEMBER_CHANGE, MAINTENANCE), and execution calldata.
- FR-3.2: Proposal eligibility SHALL be verified via a ZKP proving OWNER role membership without revealing the proposer's address.
- FR-3.3: Proposals SHALL follow a lifecycle: DRAFT → ACTIVE → SUCCEEDED / DEFEATED → EXECUTED / EXPIRED.
- FR-3.4: The voting window SHALL be configurable (default: 7 days in blocks).
- FR-3.5: Quorum requirements SHALL be configurable (default: 50% of OWNER members).

### 5.3.2 Anonymous Voting
- FR-3.6: Voting SHALL use a ZKP-based scheme (based on the VoteProof circuit) that proves: (a) the voter is an eligible member, (b) the voter has not previously voted on this proposal (nullifier), and (c) the vote is a valid choice (YES / NO / ABSTAIN).
- FR-3.7: Individual votes SHALL be private — only the aggregate tally is publicly visible.
- FR-3.8: The GovernanceDAO contract SHALL store a vote nullifier Merkle tree per proposal to prevent double-voting.
- FR-3.9: Vote tallies SHALL be updated on-chain in real time as valid vote proofs are submitted.

### 5.3.3 Proposal Execution
- FR-3.10: Successful proposals (quorum met, majority YES) SHALL be queued in a Timelock contract with a minimum execution delay (default: 48 hours).
- FR-3.11: Any member SHALL be able to trigger execution after the timelock expires.
- FR-3.12: Execution SHALL call the encoded calldata on the target contract, enabling automated on-chain enforcement.

## 5.4 Module 4 — Maintenance & Issue Tracking
### 5.4.1 Issue Reporting
- FR-4.1: Any member (any role) SHALL be able to submit a maintenance issue report, proving membership via ZKP without revealing identity.
- FR-4.2: Reports SHALL include: resource_id, severity (LOW/MEDIUM/HIGH/CRITICAL), description hash (IPFS CID of full description), and estimated urgency window.
- FR-4.3: Reports SHALL be assigned a unique issue_id and stored in the MaintenanceTracker contract.

### 5.4.2 Task Assignment & Completion
- FR-4.4: ADMINs SHALL be able to assign issues to MAINTAINER-role accounts with a budget allocation and deadline.
- FR-4.5: MAINTAINER accounts SHALL log task completion by submitting a completion proof (IPFS CID of photographic evidence + work log hash).
- FR-4.6: Upon completion logging, the smart contract SHALL release the escrowed payment to the MAINTAINER's wallet.
- FR-4.7: ADMINs MAY dispute a completion claim within a 48-hour window, triggering a DAO vote to resolve the dispute.

## 5.5 Module 5 — Notifications & Dashboard
- FR-5.1: The front-end SHALL provide a real-time dashboard displaying: active bookings, resource availability calendar, open governance proposals, and pending maintenance tasks.
- FR-5.2: The system SHALL support push notifications (web browser push API) for: booking confirmations, proposal voting open/closed, maintenance task assigned/completed.
- FR-5.3: The dashboard SHALL display a user's ZKP proof status (valid/expired) and prompt renewal when approaching expiry.
- FR-5.4: An admin panel SHALL provide aggregate analytics: total bookings per resource, revenue per period, DAO vote participation rates, maintenance resolution times.


# 6. Non-Functional Requirements
## 6.1 Performance

## 6.2 Scalability
- NFR-2.1: The system architecture SHALL support horizontal scaling of the off-chain prover by adding prover nodes without smart contract changes.
- NFR-2.2: The Merkle trees used for booking and voting commitments SHALL support at least 2^20 (1,048,576) leaf entries before requiring a tree rotation.
- NFR-2.3: IPFS storage SHALL be pinned on at least 3 geographically distributed nodes.

## 6.3 Security
- NFR-3.1: All smart contracts SHALL undergo a formal audit simulation using Slither and Mythril static analysis tools before testnet deployment.
- NFR-3.2: ZKP circuits SHALL be audited for soundness and completeness using established ZK audit methodologies.
- NFR-3.3: No private keys or seed phrases SHALL be stored client-side; all signing SHALL be delegated to the user's Web3 wallet.
- NFR-3.4: All IPFS content CIDs SHALL be committed on-chain to prevent substitution attacks.
- NFR-3.5: The system SHALL implement rate limiting on ZKP submission endpoints (max 100 proofs/hour per address) to prevent DoS via expensive on-chain verifications.
- NFR-3.6: Front-end SHALL implement Content Security Policy (CSP) headers, HTTPS enforcement, and subresource integrity checks for all external scripts.

## 6.4 Privacy
- NFR-4.1: No personally identifiable information (PII) SHALL be stored on-chain in plaintext.
- NFR-4.2: The mapping between on-chain DIDs and real-world identities SHALL remain exclusively under user control.
- NFR-4.3: ZKP nullifiers SHALL be generated using a cryptographically secure pseudo-random function (PRF) to prevent linkability.
- NFR-4.4: The system SHALL be compliant with the privacy-by-design principles of GDPR (data minimization, purpose limitation, user control).

## 6.5 Availability & Reliability
- NFR-5.1: ZKBase Layer 2 availability is inherited from ZKBase infrastructure; the dApp frontend targets 99.5% uptime via CDN deployment.
- NFR-5.2: Smart contracts SHALL be upgradeable via a Transparent Proxy pattern (OpenZeppelin) with a 72-hour governance-gated upgrade delay.
- NFR-5.3: The system SHALL implement circuit breakers in smart contracts: ADMINs can pause all booking operations in case of a critical vulnerability.

## 6.6 Usability
- NFR-6.1: Non-technical users SHALL be able to complete a full booking flow without understanding ZKPs — the UI SHALL abstract all proof generation.
- NFR-6.2: All user actions SHALL provide clear feedback within 1 second: loading indicators for proof generation, success/failure states for transactions.
- NFR-6.3: The application SHALL support MetaMask and WalletConnect-compatible wallets.
- NFR-6.4: The system SHALL provide internationalization support for English (primary) and be structured for additional locale additions.


# 7. System Architecture
## 7.1 Architecture Overview

## 7.2 Component Architecture

## 7.3 Data Flow — Booking with ZKP
### Step-by-Step Flow
- User selects a resource and time slot in the front-end UI.
- Front-end fetches the current booking commitment Merkle root from ResourceBooking contract.
- Front-end constructs ZKP circuit inputs: {user_secret, role_commitment, resource_id, slot_start, slot_end, merkle_root, nullifier}.
- Front-end sends circuit inputs to the off-chain Prover Node via encrypted API call.
- Prover Node generates a PLONK proof and returns {proof, public_inputs} to the front-end.
- Front-end prompts user to sign and submit the booking transaction via their Web3 wallet.
- ResourceBooking contract calls VerifierContract.verify(proof, public_inputs).
- On successful verification: nullifier is stored, booking commitment added to Merkle tree, payment held in escrow.
- BookingConfirmed event is emitted; front-end updates UI and sends push notification.

## 7.4 Smart Contract Architecture
### 7.4.1 IdentityRegistry.sol
- Stores: mapping(address => DID), mapping(bytes32 => Role), AttributeCommitmentMerkleRoot
- Key Functions: registerDID(), updateAttributes(), grantRole(), revokeRole(), verifyMembership()
- Events: DIDRegistered, AttributesUpdated, RoleGranted, RoleRevoked
- Access Control: Ownable + RBAC modifier checks

### 7.4.2 ResourceBooking.sol
- Stores: ResourceRegistry mapping, BookingCommitmentTree, NullifierSet, EscrowBalances
- Key Functions: registerResource(), submitBooking(), cancelBooking(), releaseEscrow()
- Events: ResourceRegistered, BookingSubmitted, BookingCancelled, EscrowReleased
- ZKP Integration: Calls MembershipVerifier and AvailabilityVerifier for each booking

### 7.4.3 GovernanceDAO.sol
- Stores: Proposal[], VoteNullifierTree per proposal, TimelockQueue
- Key Functions: submitProposal(), castVote(), queueProposal(), executeProposal()
- Events: ProposalSubmitted, VoteCast, ProposalQueued, ProposalExecuted
- ZKP Integration: Calls VoteVerifier for each vote submission

### 7.4.4 MaintenanceTracker.sol
- Stores: IssueRegistry mapping, TaskAssignments, CompletionClaims
- Key Functions: reportIssue(), assignTask(), logCompletion(), disputeCompletion()
- Events: IssueReported, TaskAssigned, TaskCompleted, DisputeRaised


# 8. ZKP Circuit Specifications
## 8.1 Circuit Overview

## 8.2 PLONK Implementation Notes
- All circuits shall be implemented using the circom 2.x language and compiled with the snarkjs PLONK backend.
- The universal trusted setup (Powers of Tau) from the Hermez/Iden3 ceremony shall be used for PLONK's structured reference string (SRS).
- Verifier contracts are auto-generated by snarkjs from the circuit verification key and deployed as immutable contracts.
- Proof generation shall be performed in WebAssembly (wasm) on the client side for MembershipProof and ReportProof; server-side for AvailabilityProof and VoteProof (due to computational cost).
- Circuit constraint counts: MembershipProof ~50K constraints, AvailabilityProof ~80K, VoteProof ~120K.

## 8.3 Nullifier Design
Nullifiers prevent proof replay. Each nullifier is computed as:
nullifier = Poseidon(user_secret || context_id)
Where context_id encodes the specific action (e.g., proposal_id for voting, slot_id for booking). Nullifiers are stored in a Sparse Merkle Tree on-chain, enabling O(log n) inclusion proofs without revealing the user's secret.


# 9. Front-End Requirements
## 9.1 Application Structure

## 9.2 ZKP UX Design Principles
- Proof generation SHALL be shown as a non-blocking progress indicator with plain-language explanation: 'Generating privacy proof... your data stays on your device.'
- Users SHALL never be asked to manually handle proof bytes, circuit files, or cryptographic keys.
- All ZKP-related errors SHALL present user-friendly messages with actionable next steps.
- The UI SHALL display a 'Privacy Shield' icon on all actions protected by ZKPs with a tooltip explanation.

## 9.3 Wallet Integration
- Primary: MetaMask (injected provider).
- Secondary: WalletConnect v2 (QR code for mobile wallets).
- Network detection: Auto-prompt to switch to ZKBase L2 network if on wrong chain.
- Gas estimation: Display estimated L2 gas cost in USD equivalent before every transaction.

## 9.4 Technology Stack


# 10. Security Model
## 10.1 Threat Model

## 10.2 Audit & Testing Requirements
- All smart contracts SHALL pass Slither static analysis with no HIGH or CRITICAL findings.
- All smart contracts SHALL achieve > 90% line coverage in Hardhat/Foundry unit tests.
- ZKP circuits SHALL be verified for soundness using formal methods or a third-party circuit audit checklist.
- Fuzz testing SHALL be performed on all public contract entry points using Foundry's fuzzer.
- A manual penetration test simulation SHALL be documented covering the top 10 OWASP Smart Contract risks.


# 11. Development Roadmap
## 11.1 Phased Delivery Plan

## 11.2 Milestones & Key Dates
- M1 (Week 2): Dev environment operational; first contract deployed on ZKBase testnet.
- M2 (Week 5): DID registration and ZKP authentication fully operational.
- M3 (Week 9): Booking system end-to-end functional with private availability proofs.
- M4 (Week 12): DAO governance with anonymous voting live on testnet.
- M5 (Week 14): All four core modules integrated and functional.
- M6 (Week 17): Security audit complete, codebase production-ready for prototype.
- M7 (Week 18): Final demo, documentation, and portfolio submission.


# 12. Success Metrics & Acceptance Criteria
## 12.1 Functional Acceptance Criteria

## 12.2 Portfolio / Academic Success Metrics
- Complete working prototype demo video (< 10 minutes) covering all four modules.
- GitHub repository with > 90% test coverage, CI pipeline, and comprehensive README.
- Architecture document covering ZKP circuit design, contract interactions, and data flow.
- At least one deployed smart contract verifiable on ZKBase testnet block explorer.
- Documented comparison of gas costs: L1 vs ZKBase L2 for equivalent operations.

# 13. Future Enhancements (Post v1.0)
## 13.1 NFT-Based Ownership
- Represent fractional cottage ownership shares as ERC-721 or ERC-1155 NFTs.
- Ownership NFT automatically confers OWNER role in IdentityRegistry.
- Transfer of ownership NFT atomically transfers governance rights.

## 13.2 IoT Integration
- Smart lock access controlled by ZKP-based authentication — user generates proof on mobile, lock verifies via ZKBase oracle.
- Sensor data (occupancy, temperature) logged via a Chainlink-style oracle to ZKBase.
- Automated maintenance triggers: if temperature sensor exceeds threshold, auto-create maintenance issue.

## 13.3 Cross-Chain Interoperability
- Bridge support for payments from other chains (Polygon, Arbitrum, Base) via LayerZero or Axelar.
- Cross-chain DAO voting using cross-chain messaging protocols.

## 13.4 Privacy-Preserving Analytics
- Implement ZKP-based aggregate analytics: prove statistical properties of booking data without revealing individual bookings.
- Differential privacy techniques applied to usage reports.

## 13.5 Mobile Applications
- React Native app with WalletConnect deep-link for mobile-first booking and governance.
- Progressive Web App (PWA) as intermediate step before native apps.

# 14. Assumptions, Dependencies & Risks
## 14.1 Assumptions
- ZKBase testnet remains operational and accessible throughout the development period.
- The PLONK verifier contract generation via snarkjs produces EVM-compatible Solidity code.
- Browser WebAssembly performance is sufficient for client-side MembershipProof generation.
- IPFS Pinata free tier is sufficient for prototype data volumes.

## 14.2 External Dependencies

## 14.3 Risk Register

# 15. Appendix
## 15.1 Glossary

## 15.2 References
- ZKBase Wiki (English) — FAQ. https://en.wiki.zks.org/faq
- ZKBase Wiki (English) — RESTful API. https://en.wiki.zks.org/interact-with-zkswap/restful-api
- W3C Decentralized Identifiers (DIDs) v1.0. https://www.w3.org/TR/did-core/
- PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge. Gabizon, Williamson, Ciobotaru (2019).
- OpenZeppelin Contracts v5. https://docs.openzeppelin.com/contracts/5.x/
- circom Documentation. https://docs.circom.io/
- snarkjs Repository. https://github.com/iden3/snarkjs
- Hardhat Development Environment. https://hardhat.org/
- Foundry Book. https://book.getfoundry.sh/
- ethers.js v6 Documentation. https://docs.ethers.org/v6/

## 15.3 Document Revision History

| Document Version | 1.0 — Initial Release |
| --- | --- |
| Status | Draft — Under Review |
| Classification | Internal / Portfolio |
| Prepared For | Engineering, Product & Stakeholder Review |
| Blockchain Layer | ZKBase (ZK-Rollup Layer 2 on Ethereum) |
| ZKP Algorithm | PLONK |
| Date | April 2026 |
| Strategic Intent: DCMS is simultaneously a production-grade decentralized application prototype and a comprehensive college-level engineering capstone demonstrating mastery of blockchain systems, ZK cryptography, smart contract development, and full-stack dApp architecture. |
| --- |
| Persona | Role | Technical Level | Primary Goals |
| --- | --- | --- | --- |
| Alex — The Owner | Cottage property owner / co-owner | Low–Medium | Track usage, manage bookings, view financials |
| Sam — The Guest | Invited guest / seasonal renter | Low | Browse availability, make reservations, pay securely |
| Jordan — The Admin | Elected community administrator | Medium | Manage members, assign roles, resolve disputes |
| Morgan — The Maintainer | Handyman / maintenance crew | Low | View assigned tasks, log completion, request supplies |
| Casey — The Developer | dApp developer / integrator | High | Access APIs, extend smart contracts, write ZKP circuits |
| Metric | Target | Measurement Method |
| --- | --- | --- |
| ZKP proof generation (client-side) | < 3 seconds on modern browser (WebAssembly prover) | Automated benchmark suite |
| ZKP proof verification (on-chain) | < 500ms transaction confirmation on ZKBase L2 | Hardhat/Foundry gas tests |
| Booking transaction throughput | > 500 TPS on ZKBase L2 | Load test with k6 |
| Front-end initial page load | < 2 seconds on 4G connection | Lighthouse CI |
| Smart contract function gas cost | < 200,000 gas per booking operation | Foundry gas snapshots |
| IPFS metadata retrieval | < 1 second for cached CIDs | Integration test suite |
| DCMS follows a three-tier architecture: (1) ZKBase Layer 2 blockchain with smart contracts, (2) Off-chain ZKP prover and IPFS storage layer, and (3) React/Next.js front-end dApp. All privacy-sensitive logic is enforced at Layer 1 & 2 through cryptographic proofs. |
| --- |
| Component | Technology | Responsibility |
| --- | --- | --- |
| ZKBase L2 Network | ZK-Rollup on Ethereum | Settle transactions, store commitments, verify ZK proofs |
| IdentityRegistry Contract | Solidity 0.8.x | Manage DIDs, roles, attribute commitments |
| ResourceBooking Contract | Solidity 0.8.x | Booking logic, availability tree, payment escrow |
| GovernanceDAO Contract | Solidity 0.8.x | Proposals, anonymous voting, timelock execution |
| MaintenanceTracker Contract | Solidity 0.8.x | Issue registry, task assignment, payment release |
| ZKP Verifier Contracts | Solidity (generated) | On-chain PLONK proof verification |
| Off-chain Prover Node | Rust / Node.js | Generate PLONK proofs for client requests |
| IPFS Nodes | go-ipfs / Pinata | Decentralized storage of metadata & evidence |
| Front-end dApp | Next.js, TypeScript | User interface, wallet integration, proof UX |
| Web3 Library | ethers.js v6 | Blockchain interaction, event subscription |
| Development Toolchain | Hardhat + Foundry | Compile, test, deploy, gas analysis |
| Circuit Name | Proves | Public Inputs | Private Inputs |
| --- | --- | --- | --- |
| MembershipProof | User has valid DID + role + unexpired membership | nullifier_hash, role, expiry_block, merkle_root | user_secret, did, attributes_path, merkle_siblings |
| AvailabilityProof | Time slot is free for a resource | resource_id, slot_hash, booking_merkle_root | slot_start, slot_end, booking_siblings |
| VoteProof | Voter is eligible, has not voted, vote is valid | proposal_id, vote_nullifier, tally_commitment | voter_secret, vote_choice, membership_proof |
| ReportProof | Reporter is a valid member | member_nullifier, report_hash | user_secret, membership_path |
| Page / View | Route | Access Level | Key Components |
| --- | --- | --- | --- |
| Landing / Home | / | Public | Hero, feature overview, wallet connect CTA |
| Dashboard | /dashboard | Authenticated | Booking summary, active proposals, maintenance feed |
| Resource Booking | /booking | OWNER / GUEST | Calendar, resource selector, ZKP booking flow |
| Governance | /governance | OWNER | Proposal list, anonymous vote interface, results |
| Maintenance | /maintenance | All roles | Issue report form, task list, completion logger |
| Admin Panel | /admin | ADMIN | Member management, resource registry, analytics |
| Profile / DID | /profile | Authenticated | DID viewer, role display, proof renewal |
| Wallet Connect | /connect | Public | MetaMask / WalletConnect onboarding flow |
| Layer | Technology | Rationale |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) | SSR, file-based routing, TypeScript-first |
| Language | TypeScript 5.x | Type safety for contract ABIs and ZKP interfaces |
| Styling | Tailwind CSS + shadcn/ui | Rapid, consistent, accessible component library |
| State Management | Zustand | Lightweight, ZKP proof state persistence |
| Blockchain | ethers.js v6 | ZKBase L2 RPC, event subscription, contract calls |
| ZKP (client) | snarkjs + circom wasm | In-browser PLONK proof generation |
| Testing | Vitest + Playwright | Unit + E2E testing |
| CI/CD | GitHub Actions | Automated test, lint, and deploy pipeline |
| Hosting | Vercel / IPFS | CDN delivery + decentralized fallback |
| Threat | Vector | Mitigation |
| --- | --- | --- |
| Proof Replay Attack | Resubmit a valid ZKP proof for a second booking | On-chain nullifier set; each proof is single-use |
| Sybil Attack | Create many wallets to dominate DAO votes | ZKP membership requires a unique DID commitment; one-vote-per-DID enforced |
| Front-Running | MEV bots observe pending bookings and front-run | Commitments submitted before reveal; ZKBase L2 sequencer ordering |
| Smart Contract Bug | Reentrancy or logic errors in contracts | Checks-Effects-Interactions pattern; OpenZeppelin ReentrancyGuard; Slither/Mythril audit |
| ZKP Soundness Break | Adversary generates false proof accepted by verifier | Use audited PLONK implementation; ceremony for SRS; circuit audits |
| Admin Key Compromise | ADMIN private key stolen, malicious role changes | Multi-sig (Gnosis Safe) for ADMIN actions; governance timelock for critical changes |
| IPFS Content Substitution | Attacker replaces IPFS content | On-chain CID commitments; integrity check on fetch |
| Prover Node DoS | Flood prover with expensive proof requests | Rate limiting (100 req/hr/address); proof request authentication |
| Phase | Duration | Deliverables | Exit Criteria |
| --- | --- | --- | --- |
| Phase 0 — Foundation | 2 weeks | Dev environment setup, ZKBase testnet connection, contract scaffolding, circom toolchain | Hello-world contract deployed on ZKBase testnet; circom circuit compiles |
| Phase 1 — Identity & Auth | 3 weeks | IdentityRegistry contract, MembershipProof circuit, DID registration UI, wallet connect | End-to-end: register DID, generate ZKP, verify on-chain |
| Phase 2 — Booking Engine | 4 weeks | ResourceBooking contract, AvailabilityProof circuit, booking UI, payment escrow | Full booking flow: select resource, generate proof, pay, confirm |
| Phase 3 — Governance | 3 weeks | GovernanceDAO contract, VoteProof circuit, proposal + voting UI, timelock | Anonymous vote cast, tally updated, proposal executed |
| Phase 4 — Maintenance | 2 weeks | MaintenanceTracker contract, ReportProof circuit, issue reporting UI, task completion | Issue reported, task assigned, payment released on completion |
| Phase 5 — Polish & Audit | 3 weeks | Security audit (Slither/Mythril), UX polish, gas optimization, documentation | All audit findings addressed; Lighthouse score > 90 |
| Phase 6 — Demo & Docs | 1 week | Final demo video, architecture docs, deployment guide, portfolio README | Public GitHub repository with full documentation |
| Feature | Acceptance Criteria | Test Method |
| --- | --- | --- |
| DID Registration | User registers DID; event emitted; no PII on-chain | Automated integration test |
| Role-Based Access | GUEST cannot access OWNER-only resources; ADMIN can grant roles | Unit test RBAC modifiers |
| Private Booking | Booking confirmed; identity not linkable on-chain; double-booking rejected | Integration + ZKP soundness test |
| Anonymous Voting | Vote counted; voter not identifiable; double-vote rejected | Integration test + nullifier collision check |
| Maintenance Flow | Issue reported anonymously; task paid on completion proof | End-to-end integration test |
| ZKP Verification | Valid proofs accepted; tampered proofs rejected by verifier contract | Fuzz test with invalid proofs |
| Wallet Integration | MetaMask and WalletConnect successfully sign transactions | Manual QA + Playwright E2E test |
| Dependency | Version / Source | Risk Level | Fallback |
| --- | --- | --- | --- |
| ZKBase L2 Network | ZKBase testnet | Medium | Deploy on Ethereum Goerli/Sepolia directly |
| circom compiler | v2.1.x (iden3/circom) | Low | Locked version in repo |
| snarkjs | v0.7.x (iden3/snarkjs) | Low | Locked version in repo |
| OpenZeppelin Contracts | v5.x | Low | Forked copy in repo |
| ethers.js | v6.x | Low | Locked version |
| IPFS / Pinata | Pinata API | Low | Local IPFS node fallback |
| Powers of Tau ceremony | Hermez ceremony (ptau28) | Low | Documented re-ceremony process |
| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| ZKBase API breaking change | Medium | High | Pin to specific ZKBase SDK version; maintain L1 fallback |
| PLONK circuit soundness issue | Low | Critical | Use established circom library gadgets; formal circuit review |
| Browser WebAssembly performance insufficient | Medium | Medium | Offload all proof gen to server-side prover; implement hybrid mode |
| Smart contract vulnerability | Low | High | Slither/Mythril analysis; OpenZeppelin security patterns; circuit breaker |
| Developer scope creep | High | Medium | Strict phase gating; defer all v2.0 features formally |
| ZKBase documentation gaps | Medium | Medium | Engage community Discord; study ZKSwap open-source code |
| Term | Definition |
| --- | --- |
| ZK-Rollup | A Layer 2 scaling solution that batches transactions off-chain and submits a cryptographic validity proof to Layer 1. |
| PLONK | Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge — a universal ZKP algorithm. |
| DID | Decentralized Identifier — a self-sovereign, globally unique identifier controlled by the user. |
| Nullifier | A unique, deterministic value derived from a user secret that prevents double-spending or double-voting. |
| Merkle Tree | A binary tree where each node is the hash of its children, enabling efficient and verifiable inclusion proofs. |
| DAO | Decentralized Autonomous Organization — a community governed by smart contracts and token/membership-based voting. |
| Timelock | A smart contract mechanism that enforces a mandatory delay between a governance decision and its on-chain execution. |
| Circom | A domain-specific language for defining arithmetic circuits used in ZKP systems. |
| snarkjs | A JavaScript library for generating and verifying ZK-SNARK/PLONK proofs using circom-compiled circuits. |
| IPFS | InterPlanetary File System — a peer-to-peer content-addressed distributed storage protocol. |
| EVM | Ethereum Virtual Machine — the runtime environment for smart contracts on Ethereum and compatible L2 chains. |
| SRS | Structured Reference String — the public parameters required for PLONK proof generation and verification. |
| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 0.1 | March 2026 | Core Team | Initial outline and feature list |
| 0.9 | April 2026 | Core Team | Full draft — all sections complete |
| 1.0 | April 2026 | Core Team | Finalized for stakeholder review |