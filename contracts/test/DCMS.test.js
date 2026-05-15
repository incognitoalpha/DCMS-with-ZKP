const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DCMS (ZKP Only)", function () {
  let dcms;
  let admin, user1, user2;
  let votingVerifier, bookingVerifier, reputationVerifier;

  beforeEach(async function () {
    [admin, user1, user2] = await ethers.getSigners();

    const VotingVerifier = await ethers.getContractFactory("VotingVerifier");
    votingVerifier = await VotingVerifier.deploy();

    const BookingVerifier = await ethers.getContractFactory("BookingVerifier");
    bookingVerifier = await BookingVerifier.deploy();

    const ReputationVerifier = await ethers.getContractFactory("ReputationVerifier");
    reputationVerifier = await ReputationVerifier.deploy();

    const DCMS = await ethers.getContractFactory("DCMS");
    dcms = await DCMS.deploy();

    await dcms.setVerifiers(
      await votingVerifier.getAddress(),
      await bookingVerifier.getAddress(),
      await reputationVerifier.getAddress()
    );
  });

  describe("Admin Functions", function () {
    it("should allow admin to add resources", async function () {
      await dcms.addResource("Test Cabin", "A nice cabin", ethers.parseEther("0.1"));
      const resource = await dcms.getResource(1);
      expect(resource.name).to.equal("Test Cabin");
      expect(resource.pricePerHour).to.equal(ethers.parseEther("0.1"));
    });

    it("should deploy verifiers correctly", async function () {
      expect(await dcms.votingVerifier()).to.equal(await votingVerifier.getAddress());
      expect(await dcms.bookingVerifier()).to.equal(await bookingVerifier.getAddress());
      expect(await dcms.reputationVerifier()).to.equal(await reputationVerifier.getAddress());
    });
  });

  describe("ZKP Core Architecture", function () {
    it("should allow identity registration", async function () {
      const commitment = "0x1234567890123456789012345678901234567890123456789012345678901234";
      await expect(dcms.connect(user1).registerIdentity(commitment))
        .to.emit(dcms, "IdentityRegistered")
        .withArgs(user1.address, commitment, 0);

      expect(await dcms.identityCount()).to.equal(1);
    });

    it("should revert booking with invalid verifier or bad proof", async function () {
      await dcms.addResource("Test Cabin", "A nice cabin", ethers.parseEther("0.1"));
      
      const commitment = "0x123";
      const nullifier = "0x456";
      
      // Submit empty proofs which should fail real verification
      const a = [0, 0];
      const b = [[0, 0], [0, 0]];
      const c = [0, 0];

      await expect(
        dcms.connect(user1).bookResource(
          commitment, nullifier, 1, 1000, 2000, a, b, c, { value: ethers.parseEther("0.1") }
        )
      ).to.be.revertedWith("DCMS: invalid ZK proof");
    });
  });
});