Got it — here’s your **final-year project PRD written cleanly as a normal document**, no markdown, no formatting issues. You can copy this into Word or your report directly.

---

# 🏡 Product Requirements Document (PRD)

## Decentralized Cottage Management System (DCMS Lite)

---

## 1. Overview

The Decentralized Cottage Management System (DCMS Lite) is a blockchain-based web application designed to manage shared cottage properties. It allows users to book resources, track usage, and maintain transparency without relying on a centralized system.

This project is a simplified version of a production-grade decentralized system. It is designed specifically for a final-year engineering project to demonstrate knowledge of blockchain technology, smart contracts, and decentralized applications (dApps).

---

## 2. Objectives

* Build a working decentralized application (dApp)
* Demonstrate smart contract-based booking logic
* Implement wallet-based authentication using MetaMask
* Ensure transparency in booking records using blockchain
* Provide a simple and user-friendly interface

---

## 3. Target Users

Admin: Responsible for managing resources and system configuration

User: Can view available resources and make bookings

---

## 4. Features

### 4.1 Wallet Authentication

Users connect to the application using MetaMask.
The wallet address serves as their identity in the system.

---

### 4.2 Resource Management (Admin)

Admin can:

* Add new cottage resources such as rooms or facilities
* Define resource details including name, price, and availability

---

### 4.3 Booking System

Users can:

* View available resources
* Select a time slot
* Book a resource

System ensures:

* No double booking
* All bookings are recorded on the blockchain

---

### 4.4 Booking History

Users can view their previous bookings.
All booking data is stored on-chain for transparency.

---

### 4.5 Basic Governance (Optional Feature)

Users can participate in simple voting.
Example: voting to add a new facility.

Each wallet gets one vote. No complex privacy system is implemented.

---

## 5. System Architecture

The system follows a simple architecture:

Frontend (React or Next.js) communicates with smart contracts using ethers.js.
Smart contracts are deployed on an Ethereum or Polygon test network.

Flow:
Frontend → Web3 Library (ethers.js) → Smart Contract → Blockchain

---

## 6. Smart Contract Design

### Data Structures

Resource:

* id
* name
* price
* availability status

Booking:

* user wallet address
* resource ID
* start time
* end time

---

### Core Functions

* addResource(): Allows admin to add a resource
* getResources(): Fetch all available resources
* bookResource(): Allows users to create a booking
* getBookings(): Retrieve booking history

---

## 7. Technology Stack

Frontend: React or Next.js
Styling: Tailwind CSS
Blockchain: Ethereum or Polygon Testnet
Smart Contracts: Solidity
Web3 Library: ethers.js
Wallet Integration: MetaMask
Development Tools: Hardhat

---

## 8. Security Considerations

* Prevent double booking using validation logic
* Restrict admin-only actions using access control
* Validate inputs using require statements
* Avoid storing sensitive user data on-chain

---

## 9. Non-Functional Requirements

Usability:
The system should be simple enough for non-technical users

Performance:
Booking operations should be fast and responsive

Reliability:
Smart contracts should handle logic correctly without failure

Scalability:
System should support multiple users and bookings

---

## 10. Testing Plan

* Unit testing of smart contracts using Hardhat
* Frontend testing for booking workflow
* Manual testing using multiple wallets

---

## 11. Development Plan

Phase 1 (Week 1–2):
Project setup and basic UI

Phase 2 (Week 3–4):
Smart contract development

Phase 3 (Week 5–6):
Frontend and blockchain integration

Phase 4 (Week 7):
Testing and debugging

Phase 5 (Week 8):
Final demo and documentation

---

## 12. Success Criteria

* Users can connect their wallet successfully
* Admin can add resources
* Users can book resources without conflicts
* Booking data is visible on blockchain
* Application runs without major bugs

---

## 13. Future Scope

* Integration of Zero-Knowledge Proofs (ZKP) for privacy
* Anonymous voting system (DAO-based governance)
* Mobile application development
* ERC-20 token-based payments
* IPFS integration for decentralized storage

---

## 14. Conclusion

DCMS Lite demonstrates how blockchain technology can be applied to real-world problems such as managing shared properties. While simplified, the system provides a strong foundation for understanding decentralized application architecture and can be extended into a more advanced system in the future.

---

