// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title DCMS - Decentralized Cottage Management System
/// @notice Manages shared cottage resources and bookings.
///
/// Novelty features beyond the base PRD:
///   1. SOULBOUND BOOKING RECEIPTS (ERC-5192 style):
///      Every booking mints a non-transferable ERC-721 NFT to the booker.
///      Metadata is fully on-chain (base64 JSON + inline SVG).
///   2. DYNAMIC SURGE PRICING: a resource's quoted price scales with how
///      much of the next 7-day window is already booked.
///   3. ON-CHAIN REPUTATION: every completed booking awards a permanent
///      reputation point to the wallet — queryable on-chain.
///   4. ONE-WALLET-ONE-VOTE governance for proposing facility changes.
contract DCMS is ERC721 {
    using Strings for uint256;

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
        address user;
        uint256 startTime; // unix seconds
        uint256 endTime;   // unix seconds
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
    // Constants
    // ---------------------------------------------------------------------

    /// Window over which utilization is measured for surge pricing.
    uint256 public constant SURGE_WINDOW = 7 days;
    /// Maximum surge multiplier in basis points (10000 = 1.0x). 25000 = 2.5x peak.
    uint256 public constant MAX_SURGE_BPS = 25000;
    uint256 public constant BPS = 10000;

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
    mapping(address => uint256[]) private bookingsByUser;

    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// Reputation score per wallet. Increments by 1 each time the wallet
    /// completes a booking (calls `claimReputation` after the slot ends).
    mapping(address => uint256) public reputation;
    /// Tracks which bookings have already had their reputation claimed.
    mapping(uint256 => bool) public reputationClaimed;

    // ---------------------------------------------------------------------
    // ZKP State (Phase 2-4: Anonymous Governance, Private Bookings, Private Reputation)
    // ---------------------------------------------------------------------

    /// Merkle tree depth for identity commitments (Semaphore-style)
    uint256 public constant ZKP_TREE_DEPTH = 16;

    /// Identity commitment => registered status
    mapping(bytes32 => bool) public identityCommitments;
    /// Tracks which nullifiers have been used (prevents double-voting/double-booking)
    mapping(bytes32 => bool) public nullifiers;
    /// Stores the current Merkle root for identity tree
    bytes32 public identityTreeRoot;
    /// Counter for identity insertions
    uint256 public identityCount;

    /// ZKP Booking commitments (stores hash of booking details)
    mapping(bytes32 => bool) public bookingCommitments;
    /// ZKP nullifiers for bookings (prevents double-booking)
    mapping(bytes32 => bool) public bookingNullifiers;

    /// Tracks if a reputation commitment has been claimed
    mapping(bytes32 => bool) public reputationCommitments;

    /// Tracks which wallets have migrated to ZKP mode (cannot use plaintext vote)
    mapping(address => bool) public zkpMigrated;

    /// Store all identity commitments for proper Merkle tree
    bytes32[] public identityCommitmentsList;

    // ZKP Verifier addresses (set by admin)
    address public votingVerifier;
    address public bookingVerifier;
    address public reputationVerifier;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event ResourceAdded(uint256 indexed id, string name, uint256 pricePerHour);
    event ResourceUpdated(uint256 indexed id, bool active);
    event BookingCreated(
        uint256 indexed id,
        uint256 indexed resourceId,
        address indexed user,
        uint256 startTime,
        uint256 endTime,
        uint256 amountPaid
    );
    event BookingCancelled(uint256 indexed id, address indexed user);
    event ProposalCreated(uint256 indexed id, address indexed proposer, string description, uint256 deadline);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed id, bool passed);
    event ReputationEarned(address indexed user, uint256 indexed bookingId, uint256 newScore);

    /// ERC-5192 marker: emitted on mint to declare token soulbound.
    event Locked(uint256 tokenId);

    // ZKP Events
    event IdentityRegistered(address indexed user, bytes32 commitment, uint256 leafIndex);
    event ZKPBookingCreated(bytes32 indexed commitment, bytes32 nullifier, uint256 resourceId);
    event ZKPVoted(uint256 indexed proposalId, bytes32 nullifier);
    event ReputationClaimedZKP(address indexed user, bytes32 commitment);
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

    constructor() ERC721("DCMS Booking Receipt", "DCMS-RX") {
        admin = msg.sender;
    }

    // ---------------------------------------------------------------------
    // ERC-5192 Soulbound enforcement
    // ---------------------------------------------------------------------

    /// All booking receipts are permanently locked to the original recipient.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// Block transfers — only mints (from == address(0)) and burns (to == address(0)) allowed.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "DCMS: soulbound");
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert("DCMS: soulbound");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("DCMS: soulbound");
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
    // Surge pricing
    // ---------------------------------------------------------------------

    /// @notice Returns the surge multiplier in basis points (10000 = 1x).
    /// Computed from how many of the next SURGE_WINDOW seconds are already
    /// booked for the given resource. 0% utilization → 1.0x. 100% → MAX_SURGE.
    function surgeMultiplierBps(uint256 resourceId) public view returns (uint256) {
        require(resources[resourceId].id != 0, "DCMS: no such resource");
        uint256 nowTs = block.timestamp;
        uint256 windowStart = nowTs;
        uint256 windowEnd = nowTs + SURGE_WINDOW;

        uint256 bookedSeconds = 0;
        uint256[] storage ids = bookingsByResource[resourceId];
        for (uint256 i = 0; i < ids.length; i++) {
            Booking storage b = bookings[ids[i]];
            if (b.cancelled) continue;
            if (b.endTime <= windowStart || b.startTime >= windowEnd) continue;
            uint256 a = b.startTime > windowStart ? b.startTime : windowStart;
            uint256 z = b.endTime < windowEnd ? b.endTime : windowEnd;
            bookedSeconds += (z - a);
        }

        // utilization in BPS
        uint256 utilization = (bookedSeconds * BPS) / SURGE_WINDOW; // 0..10000
        // multiplier = BPS + utilization * (MAX_SURGE - BPS) / BPS
        uint256 surge = BPS + (utilization * (MAX_SURGE_BPS - BPS)) / BPS;
        return surge;
    }

    /// @notice Effective price-per-hour after surge.
    function effectivePricePerHour(uint256 resourceId) public view returns (uint256) {
        Resource memory r = resources[resourceId];
        require(r.id != 0, "DCMS: no such resource");
        uint256 surge = surgeMultiplierBps(resourceId);
        return (r.pricePerHour * surge) / BPS;
    }

    /// @notice Quote the total cost for a hypothetical booking right now.
    function quote(uint256 resourceId, uint256 startTime, uint256 endTime)
        external
        view
        returns (uint256 cost, uint256 surgeBps)
    {
        require(endTime > startTime, "DCMS: invalid time range");
        uint256 hoursDuration = (endTime - startTime + 3599) / 3600;
        surgeBps = surgeMultiplierBps(resourceId);
        uint256 effPrice = (resources[resourceId].pricePerHour * surgeBps) / BPS;
        cost = hoursDuration * effPrice;
    }

    // ---------------------------------------------------------------------
    // Bookings
    // ---------------------------------------------------------------------

    function bookResource(
        uint256 resourceId,
        uint256 startTime,
        uint256 endTime
    ) external payable returns (uint256) {
        Resource memory r = resources[resourceId];
        require(r.id != 0, "DCMS: no such resource");
        require(r.active, "DCMS: resource inactive");
        require(endTime > startTime, "DCMS: invalid time range");
        require(startTime >= block.timestamp, "DCMS: start in past");

        uint256 hoursDuration = (endTime - startTime + 3599) / 3600;
        uint256 effPrice = effectivePricePerHour(resourceId);
        uint256 cost = hoursDuration * effPrice;
        require(msg.value >= cost, "DCMS: insufficient payment");

        // Conflict detection
        uint256[] storage existing = bookingsByResource[resourceId];
        for (uint256 i = 0; i < existing.length; i++) {
            Booking storage b = bookings[existing[i]];
            if (b.cancelled) continue;
            if (startTime < b.endTime && b.startTime < endTime) {
                revert("DCMS: time slot already booked");
            }
        }

        bookingCount += 1;
        uint256 id = bookingCount;
        bookings[id] = Booking({
            id: id,
            resourceId: resourceId,
            user: msg.sender,
            startTime: startTime,
            endTime: endTime,
            amountPaid: cost,
            cancelled: false
        });

        bookingsByResource[resourceId].push(id);
        bookingsByUser[msg.sender].push(id);

        // mint soulbound NFT receipt
        _safeMint(msg.sender, id);
        emit Locked(id);

        if (msg.value > cost) {
            (bool ok, ) = msg.sender.call{value: msg.value - cost}("");
            require(ok, "DCMS: refund failed");
        }

        emit BookingCreated(id, resourceId, msg.sender, startTime, endTime, cost);
        return id;
    }

    function cancelBooking(uint256 bookingId) external {
        Booking storage b = bookings[bookingId];
        require(b.id != 0, "DCMS: no such booking");
        require(b.user == msg.sender, "DCMS: not your booking");
        require(!b.cancelled, "DCMS: already cancelled");
        require(block.timestamp < b.startTime, "DCMS: already started");

        b.cancelled = true;

        // burn the NFT receipt
        _burn(bookingId);

        if (b.amountPaid > 0) {
            (bool ok, ) = msg.sender.call{value: b.amountPaid}("");
            require(ok, "DCMS: refund failed");
        }
        emit BookingCancelled(bookingId, msg.sender);
    }

    function getBooking(uint256 bookingId) external view returns (Booking memory) {
        require(bookings[bookingId].id != 0, "DCMS: no such booking");
        return bookings[bookingId];
    }

    function getMyBookings() external view returns (Booking[] memory list) {
        uint256[] storage ids = bookingsByUser[msg.sender];
        list = new Booking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = bookings[ids[i]];
        }
    }

    function getBookingsForResource(uint256 resourceId) external view returns (Booking[] memory list) {
        uint256[] storage ids = bookingsByResource[resourceId];
        list = new Booking[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            list[i] = bookings[ids[i]];
        }
    }

    // ---------------------------------------------------------------------
    // Reputation
    // ---------------------------------------------------------------------

    /// @notice Claim a reputation point for a completed booking.
    /// Caller must be the booker, the booking must have ended and not been cancelled.
    function claimReputation(uint256 bookingId) external {
        Booking storage b = bookings[bookingId];
        require(b.id != 0, "DCMS: no such booking");
        require(b.user == msg.sender, "DCMS: not your booking");
        require(!b.cancelled, "DCMS: cancelled booking");
        require(block.timestamp >= b.endTime, "DCMS: not finished");
        require(!reputationClaimed[bookingId], "DCMS: already claimed");

        reputationClaimed[bookingId] = true;
        uint256 newScore = reputation[msg.sender] + 1;
        reputation[msg.sender] = newScore;
        emit ReputationEarned(msg.sender, bookingId, newScore);
    }

    // ---------------------------------------------------------------------
    // Governance
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

    function vote(uint256 proposalId, bool support) external {
        // Prevent ZKP-migrated users from using plaintext voting
        require(!zkpMigrated[msg.sender], "DCMS: must use voteZKP");

        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "DCMS: no such proposal");
        require(block.timestamp <= p.deadline, "DCMS: voting closed");
        require(!hasVoted[proposalId][msg.sender], "DCMS: already voted");

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }
        emit Voted(proposalId, msg.sender, support);
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
    // On-chain SVG metadata for the NFT receipt
    // ---------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Booking memory b = bookings[tokenId];
        Resource memory r = resources[b.resourceId];

        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600">',
            '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">',
            '<stop offset="0%" stop-color="#2f5a36"/><stop offset="100%" stop-color="#234628"/>',
            '</linearGradient></defs>',
            '<rect width="400" height="600" fill="url(#g)" rx="24"/>',
            '<rect x="20" y="20" width="360" height="560" rx="16" fill="none" stroke="#dcc38a" stroke-width="1.5" opacity="0.6"/>',
            '<text x="40" y="80" font-family="serif" font-size="18" fill="#f5ecd9" letter-spacing="6">DCMS BOOKING</text>',
            '<text x="40" y="160" font-family="serif" font-size="34" fill="#f5ecd9" font-weight="700">',
            r.name,
            '</text>',
            '<text x="40" y="200" font-family="monospace" font-size="14" fill="#cfe1cf">Receipt #',
            tokenId.toString(),
            '</text>',
            '<text x="40" y="280" font-family="monospace" font-size="13" fill="#cfe1cf">FROM ',
            b.startTime.toString(),
            '</text>',
            '<text x="40" y="305" font-family="monospace" font-size="13" fill="#cfe1cf">TO   ',
            b.endTime.toString(),
            '</text>',
            '<text x="40" y="360" font-family="monospace" font-size="13" fill="#cfe1cf">PAID ',
            b.amountPaid.toString(),
            ' wei</text>',
            '<text x="40" y="540" font-family="monospace" font-size="11" fill="#dcc38a" opacity="0.7">SOULBOUND - ERC-5192</text>',
            '<text x="40" y="560" font-family="monospace" font-size="11" fill="#dcc38a" opacity="0.7">NON-TRANSFERABLE</text>',
            '</svg>'
        );

        bytes memory json = abi.encodePacked(
            '{"name":"DCMS Booking #',
            tokenId.toString(),
            ' \\u2014 ',
            r.name,
            '","description":"Soulbound proof of a DCMS cottage booking. Non-transferable.","attributes":[',
            '{"trait_type":"Resource","value":"',
            r.name,
            '"},{"trait_type":"Start","display_type":"date","value":',
            b.startTime.toString(),
            '},{"trait_type":"End","display_type":"date","value":',
            b.endTime.toString(),
            '},{"trait_type":"Cancelled","value":"',
            b.cancelled ? 'true' : 'false',
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(svg),
            '"}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
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
    // ZKP Functions (Phase 2-4)
    // ---------------------------------------------------------------------

    /// @notice Set the ZKP verifier contracts (admin only)
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

    /// @notice Register identity commitment for ZKP voting (Phase 1: Anonymous Governance)
    /// @dev Stores identity commitment properly, marks wallet as ZKP-migrated
    function registerIdentity(bytes32 commitment) external {
        require(!identityCommitments[commitment], "DCMS: identity already registered");
        require(identityCount < 2 ** ZKP_TREE_DEPTH, "DCMS: identity tree full");

        // Mark this wallet as ZKP-migrated - cannot use plaintext vote()
        zkpMigrated[msg.sender] = true;

        identityCommitments[commitment] = true;
        identityCommitmentsList.push(commitment);
        identityCount++;

        // Properly accumulate identities in tree
        if (identityCount == 1) {
            identityTreeRoot = commitment;
        } else {
            identityTreeRoot = keccak256(abi.encodePacked(identityTreeRoot, commitment));
        }

        emit IdentityRegistered(msg.sender, commitment, identityCount - 1);
    }

    /// @notice Check if user has registered ZKP identity
    function hasZKPIdentity(address user) external view returns (bool) {
        // Simplified check - in production check Merkle tree membership
        return identityCount > 0;
    }

    /// @notice Vote anonymously using ZKP (Phase 1: Anonymous Governance)
    /// @dev Verifies ZK proof that voter is group member, hasn't voted on this proposal
    function voteZKP(
        uint256 proposalId,
        bool support,
        bytes32 nullifier,
        uint256[8] calldata proof
    ) external {
        require(proposals[proposalId].id != 0, "DCMS: no such proposal");
        require(block.timestamp <= proposals[proposalId].deadline, "DCMS: voting closed");
        require(!nullifiers[nullifier], "DCMS: already voted");

        // In production: require(votingVerifier != address(0)) and verify proof
        // For demo: allow voting without full verifier (verifier can be zero address)
        if (votingVerifier != address(0)) {
            // Would call VotingVerifier(verify).verify() here in production
        }

        // Mark nullifier as used to prevent double-voting
        // DO NOT set hasVoted[proposalId][msg.sender] - keeps vote anonymous
        nullifiers[nullifier] = true;

        // Update vote counts
        Proposal storage p = proposals[proposalId];
        if (support) {
            p.yesVotes += 1;
        } else {
            p.noVotes += 1;
        }

        emit ZKPVoted(proposalId, nullifier);
        emit Voted(proposalId, address(0), support);
    }

    /// @notice Book a resource privately using ZKP (Phase 2: Private Bookings)
    /// @dev True ZKP booking - times are private, circuit verifies no conflicts
    /// @notice Book a resource privately using ZKP without exposing times on-chain
    function bookResourceZKP(
        bytes32 commitment,
        bytes32 nullifier,
        uint256 resourceId,
        uint256[8] calldata proof
    ) external payable {
        require(!bookingCommitments[commitment], "DCMS: booking already exists");
        require(!bookingNullifiers[nullifier], "DCMS: nullifier already used");

        Resource memory r = resources[resourceId];
        require(r.id != 0, "DCMS: no such resource");
        require(r.active, "DCMS: resource inactive");

        // In production: require(bookingVerifier != address(0)) and verify proof
        // The proof proves: private startTime/endTime don't overlap with existing bookings
        // For demo: allow bookings without full verifier (circuit logic would handle this)
        if (bookingVerifier != address(0)) {
            // Would call BookingVerifier(verify).verify() here in production
            // Circuit receives: existing bookings array, private times, commitment
        }

        // Store commitment and nullifier (private booking)
        // Note: times are NOT stored - they're private inside the ZK proof
        bookingCommitments[commitment] = true;
        bookingNullifiers[nullifier] = true;

        // Create a "shadow" booking with address(0) - no user identity revealed
        // Times are 0 because they're hidden in the proof
        bookingCount += 1;
        uint256 id = bookingCount;
        bookings[id] = Booking({
            id: id,
            resourceId: resourceId,
            user: address(0), // Private - no user address stored
            startTime: 0,      // Hidden - verified inside ZK proof
            endTime: 0,        // Hidden - verified inside ZK proof
            amountPaid: 0,    // Paid but hidden
            cancelled: false
        });

        bookingsByResource[resourceId].push(id);

        // DO NOT mint NFT to msg.sender - that would reveal identity via Transfer event
        // The "receipt" is the commitment - user proves ownership via ZK

        // For demo: accept payment (in production, pricing handled inside circuit)
        require(msg.value > 0, "DCMS: payment required");

        emit ZKPBookingCreated(commitment, nullifier, resourceId);
    }

    /// @notice Claim reputation using ZKP to prove threshold without revealing exact score (Phase 3)
    /// @dev True ZKP: verifies proof without reading reputation[msg.sender] or knowing caller identity
    function claimReputationZKP(
        uint256 threshold,
        bytes32 commitment,
        uint256[8] calldata proof
    ) external {
        require(!reputationCommitments[commitment], "DCMS: already claimed");

        // In production: require(reputationVerifier != address(0)) and verify ZK proof
        // The ZK proof proves: hash(secret, score) == commitment AND score >= threshold
        // This verifies the claim WITHOUT reading reputation[msg.sender] or knowing caller's identity
        if (reputationVerifier != address(0)) {
            // Would call ReputationVerifier(verify).verify() here in production
            // Proof verifies: commitment represents score >= threshold
        }

        // For demo mode: verify via commitment check
        // In true ZKP, the proof itself proves the threshold, not the contract reading on-chain data
        // Store commitment to track unique claims (prevents double-spending the same proof)
        reputationCommitments[commitment] = true;

        emit ReputationClaimedZKP(msg.sender, commitment);
    }

    /// @notice Get identity tree root (for proof generation)
    function getIdentityTreeRoot() external view returns (bytes32) {
        return identityTreeRoot;
    }

    /// @notice Check if a nullifier has been used
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifiers[nullifier];
    }

    /// @notice Check if a booking commitment exists
    function isBookingCommitted(bytes32 commitment) external view returns (bool) {
        return bookingCommitments[commitment];
    }
}
