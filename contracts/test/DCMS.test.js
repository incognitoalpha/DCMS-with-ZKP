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
});
