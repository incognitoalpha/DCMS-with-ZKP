// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVotingVerifier {
    function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[3] memory input) external view returns (bool);
}

interface IBookingVerifier {
    function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[5] memory input) external view returns (bool);
}

interface IReputationVerifier {
    function verifyProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory input) external view returns (bool);
}

/// @title DCMS - Decentralized Cottage Management System
/// @notice Manages shared cottage resources and bookings, fully ZKP-based.
contract DCMS {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Resource {
        uint256 id;
        string name;
        string description;
        uint256 pricePerHour; // base price in wei
        bool active;
    }

    struct Booking {
        uint256 id;
        uint256 resourceId;
        address user; // Kept as address(0) for privacy
        uint256 startTime; // Kept as 0 for privacy
        uint256 endTime;   // Kept as 0 for privacy
        uint256 amountPaid;
        bool cancelled;
    }

    struct Proposal {
        uint256 id;
        string description;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 deadline;
        bool executed;
        address proposer;
    }

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    address public admin;

    uint256 public resourceCount;
    uint256 public bookingCount;
    uint256 public proposalCount;

    mapping(uint256 => Resource) private resources;
    mapping(uint256 => Booking) private bookings;
    mapping(uint256 => Proposal) private proposals;

    mapping(uint256 => uint256[]) private bookingsByResource;

    // ---------------------------------------------------------------------
    // ZKP State
    // ---------------------------------------------------------------------

    uint256 public constant ZKP_TREE_DEPTH = 16;

    mapping(uint256 => bool) public identityCommitments;
    mapping(uint256 => bool) public nullifiers;
    
    uint256 public identityTreeRoot;
    uint256 public identityCount;
    uint256[] public identityCommitmentsList;

    mapping(uint256 => bool) public bookingCommitments;
    mapping(uint256 => bool) public bookingNullifiers;

    mapping(uint256 => bool) public reputationCommitments;

    address public votingVerifier;
    address public bookingVerifier;
    address public reputationVerifier;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ResourceAdded(uint256 indexed id, string name, uint256 pricePerHour);
    event ResourceUpdated(uint256 indexed id, bool active);
    event BookingCancelled(uint256 indexed id, address indexed user);
    event ProposalCreated(uint256 indexed id, address indexed proposer, string description, uint256 deadline);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id, bool passed);

    // ZKP Events
    event IdentityRegistered(address indexed user, uint256 commitment, uint256 leafIndex);
    event BookingCreated(uint256 indexed commitment, uint256 nullifier, uint256 resourceId);
    event ReputationClaimed(address indexed user, uint256 commitment);
    event VerifierUpdated(string verifierType, address newVerifier);

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "DCMS: only admin");
        _;
    }

    // ---------------------------------------------------------------------
    // Construction
    // ---------------------------------------------------------------------

    constructor() {
        admin = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Resources (Admin)
    // ---------------------------------------------------------------------

    function addResource(
        string calldata name,
        string calldata description,
        uint256 pricePerHour
    ) external onlyAdmin returns (uint256) {
        require(bytes(name).length > 0, "DCMS: name required");

        resourceCount += 1;
        uint256 id = resourceCount;
        resources[id] = Resource({
            id: id,
            name: name,
            description: description,
            pricePerHour: pricePerHour,
            active: true
        });

        emit ResourceAdded(id, name, pricePerHour);
        return id;
    }

    function setResourceActive(uint256 resourceId, bool active) external onlyAdmin {
        require(resources[resourceId].id != 0, "DCMS: no such resource");
        resources[resourceId].active = active;
        emit ResourceUpdated(resourceId, active);
    }

    function getResource(uint256 resourceId) external view returns (Resource memory) {
        require(resources[resourceId].id != 0, "DCMS: no such resource");
        return resources[resourceId];
    }

    function getAllResources() external view returns (Resource[] memory list) {
        list = new Resource[](resourceCount);
        for (uint256 i = 1; i <= resourceCount; i++) {
            list[i - 1] = resources[i];
        }
    }

    // ---------------------------------------------------------------------
    // Governance Proposals
    // ---------------------------------------------------------------------

    function createProposal(string calldata description, uint256 votingPeriodSeconds) external returns (uint256) {
        require(bytes(description).length > 0, "DCMS: description required");
        require(votingPeriodSeconds >= 60, "DCMS: period too short");

        proposalCount += 1;
        uint256 id = proposalCount;
        proposals[id] = Proposal({
            id: id,
            description: description,
            yesVotes: 0,
            noVotes: 0,
            deadline: block.timestamp + votingPeriodSeconds,
            executed: false,
            proposer: msg.sender
        });

        emit ProposalCreated(id, msg.sender, description, proposals[id].deadline);
        return id;
    }

    function executeProposal(uint256 proposalId) external returns (bool passed) {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "DCMS: no such proposal");
        require(block.timestamp > p.deadline, "DCMS: voting still open");
        require(!p.executed, "DCMS: already executed");

        p.executed = true;
        passed = p.yesVotes > p.noVotes;
        emit ProposalExecuted(proposalId, passed);
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].id != 0, "DCMS: no such proposal");
        return proposals[proposalId];
    }

    function getAllProposals() external view returns (Proposal[] memory list) {
        list = new Proposal[](proposalCount);
        for (uint256 i = 1; i <= proposalCount; i++) {
            list[i - 1] = proposals[i];
        }
    }

    // ---------------------------------------------------------------------
    // Admin maintenance
    // ---------------------------------------------------------------------

    function withdraw(address payable to, uint256 amount) external onlyAdmin {
        require(to != address(0), "DCMS: zero address");
        require(amount <= address(this).balance, "DCMS: insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "DCMS: withdraw failed");
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "DCMS: zero address");
        admin = newAdmin;
    }

    receive() external payable {}

    // ---------------------------------------------------------------------
    // ZKP Functions
    // ---------------------------------------------------------------------

    function setVerifiers(
        address _votingVerifier,
        address _bookingVerifier,
        address _reputationVerifier
    ) external onlyAdmin {
        votingVerifier = _votingVerifier;
        bookingVerifier = _bookingVerifier;
        reputationVerifier = _reputationVerifier;
        emit VerifierUpdated("voting", _votingVerifier);
        emit VerifierUpdated("booking", _bookingVerifier);
        emit VerifierUpdated("reputation", _reputationVerifier);
    }

    function registerIdentity(uint256 commitment) external {
        require(!identityCommitments[commitment], "DCMS: identity already registered");
        require(identityCount < 2 ** ZKP_TREE_DEPTH, "DCMS: identity tree full");

        identityCommitments[commitment] = true;
        identityCommitmentsList.push(commitment);
        identityCount++;

        // Basic hashing for demo root. Real deployments should compute full Merkle tree
        if (identityCount == 1) {
            identityTreeRoot = commitment;
        } else {
            identityTreeRoot = uint256(keccak256(abi.encodePacked(identityTreeRoot, commitment)));
        }

        emit IdentityRegistered(msg.sender, commitment, identityCount - 1);
    }

    function vote(
        uint256 proposalId,
        bool support,
        uint256 nullifier,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external {
        require(proposals[proposalId].id != 0, "DCMS: no such proposal");
        require(block.timestamp <= proposals[proposalId].deadline, "DCMS: voting closed");
        require(!nullifiers[nullifier], "DCMS: already voted");
        require(votingVerifier != address(0), "DCMS: verifier not set");

        uint256[3] memory inputs = [proposalId, nullifier, identityTreeRoot];
        require(IVotingVerifier(votingVerifier).verifyProof(a, b, c, inputs), "DCMS: invalid ZK proof");

        nullifiers[nullifier] = true;

        Proposal storage p = proposals[proposalId];
        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        // Emit an event without exposing the actual voter address
        emit Voted(proposalId, address(0), support);
    }

    function bookResource(
        uint256 commitment,
        uint256 nullifier,
        uint256 resourceId,
        uint256 startTime,
        uint256 endTime,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external payable {
        require(!bookingCommitments[commitment], "DCMS: booking already exists");
        require(!bookingNullifiers[nullifier], "DCMS: nullifier already used");
        require(bookingVerifier != address(0), "DCMS: verifier not set");

        Resource memory r = resources[resourceId];
        require(r.id != 0, "DCMS: no such resource");
        require(r.active, "DCMS: resource inactive");
        require(msg.value > 0, "DCMS: payment required");

        // Conflict detection
        uint256[] storage existing = bookingsByResource[resourceId];
        for (uint256 i = 0; i < existing.length; i++) {
            Booking storage bk = bookings[existing[i]];
            if (!bk.cancelled && startTime < bk.endTime && bk.startTime < endTime) {
                revert("DCMS: time slot already booked");
            }
        }

        uint256[5] memory inputs = [commitment, nullifier, resourceId, startTime, endTime];
        require(IBookingVerifier(bookingVerifier).verifyProof(a, b, c, inputs), "DCMS: invalid ZK proof");

        bookingCommitments[commitment] = true;
        bookingNullifiers[nullifier] = true;

        bookingCount += 1;
        uint256 id = bookingCount;
        bookings[id] = Booking({
            id: id,
            resourceId: resourceId,
            user: address(0),
            startTime: startTime,
            endTime: endTime,
            amountPaid: msg.value,
            cancelled: false
        });

        bookingsByResource[resourceId].push(id);
        emit BookingCreated(commitment, nullifier, resourceId);
    }

    function claimReputation(
        uint256 threshold,
        uint256 commitment,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c
    ) external {
        require(!reputationCommitments[commitment], "DCMS: already claimed");
        require(reputationVerifier != address(0), "DCMS: verifier not set");

        uint256[2] memory inputs = [threshold, commitment];
        require(IReputationVerifier(reputationVerifier).verifyProof(a, b, c, inputs), "DCMS: invalid ZK proof");

        reputationCommitments[commitment] = true;
        emit ReputationClaimed(msg.sender, commitment);
    }

    function getIdentityTreeRoot() external view returns (uint256) {
        return identityTreeRoot;
    }
}
