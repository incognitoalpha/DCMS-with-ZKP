#  Product Requirements Document (PRD)

## ZKP-Powered Decentralized Cottage Management System (DCMS)

---

## 1. Overview

The Decentralized Cottage Management System (DCMS) is a privacy-preserving blockchain application designed to manage shared cottage properties. It leverages Zero-Knowledge Proofs (ZK-SNARKs) to allow users to book resources and participate in governance without revealing their identities or specific booking details on-chain, while maintaining trustless verification and double-booking prevention.

This project demonstrates the application of ZK technology in the shared resource booking domain, focusing on anonymity, privacy, and verifiable reputation.

---

## 2. Objectives

*   **Privacy-First Booking**: Enable users to book resources via cryptographic commitments.
*   **Anonymous Governance**: Implement a voting system where votes are verified but voters remain anonymous.
*   **Verifiable Reputation**: Allow users to prove their reputation threshold without revealing their exact score.
*   **Trustless Verification**: Ensure all ZK proofs are verified on-chain by the smart contract.
*   **User-Friendly Interface**: Provide a Next.js frontend that handles proof generation (WASM) transparently.

---

## 3. Target Users

*   **Admin**: Responsible for managing resources (cottages/rooms) and system configuration.
*   **User**: Can register a ZK identity, make private bookings, and participate in anonymous voting.

---

## 4. Key Features

### 4.1 ZK Identity Registration
Users register a unique identity commitment on-chain. This identity is required for private bookings and anonymous voting, serving as a "membership" proof.

### 4.2 Private Booking System (ZK-SNARKs)
Users book resources by submitting a Groth16 proof.
*   **Privacy**: Specific user address and booking secrets are hidden.
*   **Integrity**: On-chain logic still prevents double-booking using commitment/nullifier mechanics.
*   **Verification**: The contract verifies the ZK proof before accepting the booking.

### 4.3 Anonymous Governance (ZK-SNARKs)
A "one-identity-one-vote" system for proposal voting.
*   **Anonymity**: Votes are tallied without revealing who voted for what.
*   **Prevention of Double-Voting**: Managed via ZK nullifiers.

### 4.4 Private Reputation Claims
Users earn reputation for completed bookings. They can prove they meet a certain reputation threshold (e.g., "> 5 bookings") using ZK proofs without exposing their total history.

### 4.5 Activity Feed
A live dashboard showing system events (Identity Registration, Booking Creation, Votes) while respecting the privacy constraints of the ZK implementation.

---

## 5. System Architecture

*   **Smart Contracts**: Solidity 0.8.24 on Ethereum (Hardhat). Main logic in `DCMS.sol`, verification delegated to generated Groth16 Verifier contracts.
*   **Circuits**: Circom DSL for defining ZK constraints (Booking, Voting, Reputation).
*   **Frontend**: Next.js 14 with `snarkjs` for client-side proof generation.
*   **Cryptographic Primitives**: Poseidon Hash for efficient on-chain/circuit hashing.

---

## 6. Technology Stack

*   **Frontend**: Next.js, Tailwind CSS, ethers.js
*   **Blockchain**: Solidity, Hardhat
*   **ZK-SNARKs**: Circom, snarkjs
*   **Hashing**: Poseidon (circomlibjs)

---

## 7. Success Criteria

*   Successful generation of ZK proofs in the browser for all core actions.
*   On-chain verification of Groth16 proofs for Bookings, Voting, and Reputation.
*   Successful prevention of double-booking and double-voting using ZK nullifiers.
*   Zero exposure of user addresses in sensitive transaction logs.

---
