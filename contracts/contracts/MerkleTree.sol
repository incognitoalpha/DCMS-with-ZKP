// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MerkleTree - On-chain Merkle tree for identity commitments
/// @notice Stores identity commitments in a Merkle tree for Semaphore-style anonymous voting
/// @dev Uses simple hash for demo - production would use Poseidon
contract MerkleTree {
    uint256 public constant TREE_DEPTH = 16;
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    uint256 public immutable ROOT_TIMESTAMP;
    uint256 public currentRoot;
    uint256 public nextLeafIndex;

    mapping(uint256 => uint256) public roots;
    mapping(uint256 => bool) public historicRoots;

    uint256[TREE_DEPTH + 1] public zeroValues;

    // PoseidonT3 contract address (set after deployment)
    address public poseidonAddress;

    constructor() {
        // Initialize zero values for empty tree
        zeroValues[0] = uint256(keccak256(abi.encodePacked(uint256(0)))) % FIELD_SIZE;
        for (uint256 i = 1; i <= TREE_DEPTH; i++) {
            zeroValues[i] = _hash(zeroValues[i - 1], zeroValues[i - 1]);
        }

        currentRoot = zeroValues[TREE_DEPTH];
        roots[currentRoot] = block.timestamp;
        historicRoots[currentRoot] = true;
        ROOT_TIMESTAMP = block.timestamp;
        nextLeafIndex = 0;
    }

    /// @notice Set the PoseidonT3 contract address
    function setPoseidon(address _poseidonAddress) external {
        poseidonAddress = _poseidonAddress;
    }

    /// @dev Simple hash function (replace with Poseidon in production)
    function _hash(uint256 left, uint256 right) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(left, right))) % FIELD_SIZE;
    }

    function insert(uint256 leaf) public returns (uint256) {
        require(leaf < FIELD_SIZE, "MerkleTree: leaf not in field");
        require(nextLeafIndex < 2 ** TREE_DEPTH, "MerkleTree: tree full");

        uint256 leafIndex = nextLeafIndex;
        uint256 currentIndex = leafIndex;
        uint256 currentHash = leaf;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (currentIndex % 2 == 0) {
                currentHash = _hash(currentHash, zeroValues[i]);
            } else {
                currentHash = _hash(zeroValues[i], currentHash);
            }
            currentIndex /= 2;
        }

        currentRoot = currentHash;
        roots[currentRoot] = block.timestamp;
        historicRoots[currentRoot] = true;
        nextLeafIndex++;

        return currentRoot;
    }

    function verifyProof(
        uint256 leaf,
        uint256[] calldata pathElements,
        uint256[] calldata pathIndices
    ) public view returns (bool) {
        require(pathElements.length == TREE_DEPTH, "MerkleTree: invalid path length");
        require(pathIndices.length == TREE_DEPTH, "MerkleTree: invalid indices length");

        uint256 currentHash = leaf;

        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (pathIndices[i] == 0) {
                currentHash = _hash(currentHash, pathElements[i]);
            } else {
                currentHash = _hash(pathElements[i], currentHash);
            }
        }

        return currentRoot == currentHash || historicRoots[currentHash];
    }

    function getTreeRoot() external view returns (uint256) {
        return currentRoot;
    }

    function getNextLeafIndex() external view returns (uint256) {
        return nextLeafIndex;
    }

    function isKnownRoot(uint256 root) external view returns (bool) {
        return root == currentRoot || historicRoots[root];
    }
}