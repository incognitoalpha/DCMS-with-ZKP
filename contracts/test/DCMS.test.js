const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DCMS", function () {
  async function deploy() {
    const [admin, user1, user2] = await ethers.getSigners();
    const DCMS = await ethers.getContractFactory("DCMS");
    const dcms = await DCMS.deploy();
    await dcms.waitForDeployment();
    return { dcms, admin, user1, user2 };
  }

  describe("Resources", function () {
    it("admin can add a resource", async function () {
      const { dcms } = await deploy();
      await expect(
        dcms.addResource("Lakeview Cabin", "Cozy cabin for 4", ethers.parseEther("0.01"))
      ).to.emit(dcms, "ResourceAdded");
      const r = await dcms.getResource(1);
      expect(r.name).to.equal("Lakeview Cabin");
      expect(r.active).to.equal(true);
    });

    it("non-admin cannot add a resource", async function () {
      const { dcms, user1 } = await deploy();
      await expect(
        dcms.connect(user1).addResource("X", "y", 0)
      ).to.be.revertedWith("DCMS: only admin");
    });

    it("getAllResources returns full list", async function () {
      const { dcms } = await deploy();
      await dcms.addResource("A", "a", 0);
      await dcms.addResource("B", "b", 0);
      const list = await dcms.getAllResources();
      expect(list.length).to.equal(2);
    });
  });

  describe("Bookings", function () {
    it("user can book a free slot and pays correct amount + receives soulbound NFT", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", ethers.parseEther("0.01"));

      const start = (await time.latest()) + 3600;
      const end = start + 7200; // 2 hours

      const tx = await dcms
        .connect(user1)
        .bookResource(1, start, end, { value: ethers.parseEther("0.02") });
      await expect(tx).to.emit(dcms, "BookingCreated");
      await expect(tx).to.emit(dcms, "Locked").withArgs(1);

      const b = await dcms.getBooking(1);
      expect(b.user).to.equal(user1.address);
      expect(b.amountPaid).to.equal(ethers.parseEther("0.02"));

      // ERC-721: user owns NFT #1
      expect(await dcms.ownerOf(1)).to.equal(user1.address);
      expect(await dcms.locked(1)).to.equal(true);
    });

    it("booking NFT is soulbound (no transfer)", async function () {
      const { dcms, user1, user2 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);
      const start = (await time.latest()) + 3600;
      await dcms.connect(user1).bookResource(1, start, start + 3600);

      await expect(
        dcms.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.reverted;
      await expect(dcms.connect(user1).approve(user2.address, 1)).to.be.revertedWith(
        "DCMS: soulbound"
      );
    });

    it("tokenURI returns base64 JSON metadata", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);
      const start = (await time.latest()) + 3600;
      await dcms.connect(user1).bookResource(1, start, start + 3600);
      const uri = await dcms.tokenURI(1);
      expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    });

    it("rejects overlapping bookings on the same resource", async function () {
      const { dcms, user1, user2 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);

      const start = (await time.latest()) + 3600;
      const end = start + 7200;
      await dcms.connect(user1).bookResource(1, start, end);

      await expect(
        dcms.connect(user2).bookResource(1, start + 1800, end + 1800)
      ).to.be.revertedWith("DCMS: time slot already booked");
    });

    it("allows back-to-back bookings (no overlap)", async function () {
      const { dcms, user1, user2 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);

      const start = (await time.latest()) + 3600;
      const mid = start + 3600;
      const end = mid + 3600;

      await dcms.connect(user1).bookResource(1, start, mid);
      await expect(dcms.connect(user2).bookResource(1, mid, end)).to.emit(
        dcms,
        "BookingCreated"
      );
    });

    it("rejects booking for inactive resource", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);
      await dcms.setResourceActive(1, false);
      const start = (await time.latest()) + 3600;
      await expect(
        dcms.connect(user1).bookResource(1, start, start + 3600)
      ).to.be.revertedWith("DCMS: resource inactive");
    });

    it("user can cancel and is refunded", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", ethers.parseEther("0.01"));
      const start = (await time.latest()) + 3600;
      await dcms
        .connect(user1)
        .bookResource(1, start, start + 3600, { value: ethers.parseEther("0.01") });

      const before = await ethers.provider.getBalance(user1.address);
      const tx = await dcms.connect(user1).cancelBooking(1);
      const rcpt = await tx.wait();
      const gasCost = rcpt.gasUsed * rcpt.gasPrice;
      const after = await ethers.provider.getBalance(user1.address);
      // after - before should be ~ 0.01 - gas
      expect(after + gasCost - before).to.equal(ethers.parseEther("0.01"));
    });
  });

  describe("Surge pricing", function () {
    it("returns 1x surge when no bookings", async function () {
      const { dcms } = await deploy();
      await dcms.addResource("Sauna", "warm", ethers.parseEther("0.01"));
      expect(await dcms.surgeMultiplierBps(1)).to.equal(10000n);
      expect(await dcms.effectivePricePerHour(1)).to.equal(ethers.parseEther("0.01"));
    });

    it("price scales up when window is partially booked", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", ethers.parseEther("0.01"));
      const start = (await time.latest()) + 60;
      // 2-day continuous booking inside 7-day window ≈ 28% utilization
      await dcms
        .connect(user1)
        .bookResource(1, start, start + 2 * 24 * 3600, { value: ethers.parseEther("1") });
      const surge = await dcms.surgeMultiplierBps(1);
      expect(surge).to.be.greaterThan(10000n);
      expect(surge).to.be.lessThan(25000n);
    });
  });

  describe("Reputation", function () {
    it("awards 1 point per completed booking, only once", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Sauna", "warm", 0);
      const start = (await time.latest()) + 60;
      await dcms.connect(user1).bookResource(1, start, start + 3600);
      // before completion
      await expect(dcms.connect(user1).claimReputation(1)).to.be.revertedWith(
        "DCMS: not finished"
      );
      await time.increase(4000);
      await dcms.connect(user1).claimReputation(1);
      expect(await dcms.reputation(user1.address)).to.equal(1n);
      await expect(dcms.connect(user1).claimReputation(1)).to.be.revertedWith(
        "DCMS: already claimed"
      );
    });
  });

  describe("Governance", function () {
    it("anyone can create a proposal and vote once", async function () {
      const { dcms, user1, user2 } = await deploy();
      await dcms.connect(user1).createProposal("Add hot tub", 3600);
      await dcms.connect(user1).vote(1, true);
      await dcms.connect(user2).vote(1, false);
      await expect(dcms.connect(user1).vote(1, true)).to.be.revertedWith(
        "DCMS: already voted"
      );
      const p = await dcms.getProposal(1);
      expect(p.yesVotes).to.equal(1);
      expect(p.noVotes).to.equal(1);
    });

    it("execute after deadline reports pass/fail", async function () {
      const { dcms, user1, user2, admin } = await deploy();
      await dcms.createProposal("Add hot tub", 60);
      await dcms.connect(user1).vote(1, true);
      await dcms.connect(user2).vote(1, true);
      await dcms.vote(1, false);

      await time.increase(120);
      await expect(dcms.executeProposal(1)).to.emit(dcms, "ProposalExecuted");
      const p = await dcms.getProposal(1);
      expect(p.executed).to.equal(true);
    });
  });

  describe("ZKP Identity Registration", function () {
    it("user can register identity commitment", async function () {
      const { dcms, user1 } = await deploy();
      const commitment = ethers.keccak256(ethers.toBeHex(12345));
      await expect(dcms.connect(user1).registerIdentity(commitment))
        .to.emit(dcms, "IdentityRegistered");
      expect(await dcms.identityCommitments(commitment)).to.equal(true);
    });

    it("cannot register same commitment twice", async function () {
      const { dcms, user1 } = await deploy();
      const commitment = ethers.keccak256(ethers.toBeHex(12345));
      await dcms.connect(user1).registerIdentity(commitment);
      await expect(dcms.connect(user1).registerIdentity(commitment))
        .to.be.revertedWith("DCMS: identity already registered");
    });

    it("tracks identity count", async function () {
      const { dcms, user1, user2 } = await deploy();
      await dcms.connect(user1).registerIdentity(ethers.keccak256(ethers.toBeHex(1)));
      await dcms.connect(user2).registerIdentity(ethers.keccak256(ethers.toBeHex(2)));
      expect(await dcms.identityCount()).to.equal(2n);
    });
  });

  describe("ZKP Voting", function () {
    it("can create proposal and vote with ZKP (mock)", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.createProposal("ZKP Test Proposal", 3600);

      const nullifier = ethers.keccak256(ethers.toBeHex(999));
      await expect(dcms.connect(user1).voteZKP(1, true, nullifier, [0,0,0,0,0,0,0,0]))
        .to.emit(dcms, "ZKPVoted");

      expect(await dcms.nullifiers(nullifier)).to.equal(true);
    });

    it("prevents double voting with same nullifier", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.createProposal("ZKP Test", 3600);

      const nullifier = ethers.keccak256(ethers.toBeHex(888));
      await dcms.connect(user1).voteZKP(1, true, nullifier, [0,0,0,0,0,0,0,0]);

      await expect(dcms.connect(user1).voteZKP(1, false, nullifier, [0,0,0,0,0,0,0,0]))
        .to.be.revertedWith("DCMS: already voted");
    });

    it("rejects vote on non-existent proposal", async function () {
      const { dcms, user1 } = await deploy();
      const nullifier = ethers.keccak256(ethers.toBeHex(777));
      await expect(dcms.connect(user1).voteZKP(99, true, nullifier, [0,0,0,0,0,0,0,0]))
        .to.be.revertedWith("DCMS: no such proposal");
    });

    it("cannot vote via both vote() and voteZKP() (BUG FIX)", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.createProposal("Test Proposal", 3600);

      // First register identity - this migrates user to ZKP mode
      await dcms.connect(user1).registerIdentity(ethers.keccak256(ethers.toBeHex(111)));
      expect(await dcms.zkpMigrated(user1.address)).to.equal(true);

      // Try to vote via plaintext - should fail (user is ZKP-migrated)
      await expect(dcms.connect(user1).vote(1, true))
        .to.be.revertedWith("DCMS: must use voteZKP");
    });

    it("cannot vote via both voteZKP() and vote() (BUG FIX)", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.createProposal("Test Proposal", 3600);

      // Register identity - migrates to ZKP
      await dcms.connect(user1).registerIdentity(ethers.keccak256(ethers.toBeHex(222)));

      // Vote via ZKP should work
      const nullifier = ethers.keccak256(ethers.toBeHex(888));
      await dcms.connect(user1).voteZKP(1, true, nullifier, [0,0,0,0,0,0,0,0]);

      // Try to vote via plaintext - should fail (still ZKP-migrated)
      await expect(dcms.connect(user1).vote(1, false))
        .to.be.revertedWith("DCMS: must use voteZKP");
    });
  });

  describe("ZKP Private Bookings", function () {
    it("can make private booking with ZKP commitment", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Private Cabin", "secluded", ethers.parseEther("0.01"));

      const commitment = ethers.keccak256(ethers.toBeHex(111));
      const nullifier = ethers.keccak256(ethers.toBeHex(222));

      await expect(dcms.connect(user1).bookResourceZKP(
        commitment, nullifier, 1, [0,0,0,0,0,0,0,0], { value: ethers.parseEther("0.01") }
      )).to.emit(dcms, "ZKPBookingCreated");

      expect(await dcms.bookingCommitments(commitment)).to.equal(true);
      expect(await dcms.bookingNullifiers(nullifier)).to.equal(true);
    });

    it("prevents double booking with same nullifier", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Cabin", "test", ethers.parseEther("0.01"));

      const commitment1 = ethers.keccak256(ethers.toBeHex(111));
      const nullifier = ethers.keccak256(ethers.toBeHex(333));

      await dcms.connect(user1).bookResourceZKP(
        commitment1, nullifier, 1, [0,0,0,0,0,0,0,0], { value: ethers.parseEther("0.01") }
      );

      const commitment2 = ethers.keccak256(ethers.toBeHex(112));
      await expect(dcms.connect(user1).bookResourceZKP(
        commitment2, nullifier, 1, [0,0,0,0,0,0,0,0], { value: ethers.parseEther("0.01") }
      )).to.be.revertedWith("DCMS: nullifier already used");
    });

    it("ZKP booking creates private booking without revealing times (ARCHITECTURE FIX)", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Cabin", "test", ethers.parseEther("0.01"));

      const commitment = ethers.keccak256(ethers.toBeHex(999));
      const nullifier = ethers.keccak256(ethers.toBeHex(888));

      await dcms.connect(user1).bookResourceZKP(
        commitment, nullifier, 1, [0,0,0,0,0,0,0,0], { value: ethers.parseEther("0.01") }
      );

      // Booking created with address(0) - no user identity revealed
      const b = await dcms.getBooking(1);
      expect(b.user).to.equal(ethers.ZeroAddress);

      // Times are 0 - not stored on-chain (verified inside ZK proof in production)
      expect(b.startTime).to.equal(0n);
      expect(b.endTime).to.equal(0n);
    });

    it("ZKP booking does NOT mint NFT to msg.sender (PRIVACY FIX)", async function () {
      const { dcms, user1 } = await deploy();
      await dcms.addResource("Cabin", "test", ethers.parseEther("0.01"));

      const commitment = ethers.keccak256(ethers.toBeHex(111));
      const nullifier = ethers.keccak256(ethers.toBeHex(222));

      await dcms.connect(user1).bookResourceZKP(
        commitment, nullifier, 1, [0,0,0,0,0,0,0,0], { value: ethers.parseEther("0.01") }
      );

      // User should NOT have any NFTs - no Transfer event emitted
      expect(await dcms.balanceOf(user1.address)).to.equal(0n);
    });
  });

  describe("ZKP Verifier Management", function () {
    it("admin can set verifier addresses", async function () {
      const { dcms, admin } = await deploy();
      const verifier1 = "0x1234567890123456789012345678901234567890";
      const verifier2 = "0x2345678901234567890123456789012345678901";
      const verifier3 = "0x3456789012345678901234567890123456789012";

      await dcms.setVerifiers(verifier1, verifier2, verifier3);

      expect(await dcms.votingVerifier()).to.equal(verifier1);
      expect(await dcms.bookingVerifier()).to.equal(verifier2);
      expect(await dcms.reputationVerifier()).to.equal(verifier3);
    });

    it("non-admin cannot set verifiers", async function () {
      const { dcms, user1 } = await deploy();
      const verifier = "0x1234567890123456789012345678901234567890";

      await expect(dcms.connect(user1).setVerifiers(verifier, verifier, verifier))
        .to.be.revertedWith("DCMS: only admin");
    });
  });
});
