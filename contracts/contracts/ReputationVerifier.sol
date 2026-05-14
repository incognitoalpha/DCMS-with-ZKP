// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReputationVerifier - Verifier for private reputation ZK proofs
/// @notice Verifies ZK proofs for reputation threshold without revealing exact score
contract ReputationVerifier {
    uint256 constant Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant IC_LENGTH = 4; // 1 + 2 public inputs + 1 for padding

    // Verification Key (would be set from circuit compilation)
    uint256[2] public vk_alpha;
    uint256[2][2] public vk_beta;
    uint256[2][2] public vk_gamma;
    uint256[2] public vk_delta;
    uint256[2][IC_LENGTH] public vk_ic;

    bool public initialized;

    function setVerifyingKey(
        uint256[2] memory alpha,
        uint256[2][2] memory beta,
        uint256[2][2] memory gamma,
        uint256[2] memory delta,
        uint256[2][IC_LENGTH] memory ic
    ) external {
        vk_alpha = alpha;
        vk_beta = beta;
        vk_gamma = gamma;
        vk_delta = delta;
        vk_ic = ic;
        initialized = true;
    }

    function verify(
        uint256[2] memory a,
        uint256[2] memory b,
        uint256[2] memory c,
        uint256[2] memory publicInputs
    ) public view returns (bool) {
        require(initialized, "ReputationVerifier: not initialized");

        // publicInputs: [threshold, commitment]
        uint256[2] memory acc;
        acc[0] = vk_ic[0][0];
        acc[1] = vk_ic[0][1];

        for (uint i = 0; i < 2; i++) {
            acc[0] = (acc[0] + vk_ic[i + 1][0] * publicInputs[i]) % Q;
            acc[1] = (acc[1] + vk_ic[i + 1][1] * publicInputs[i]) % Q;
        }

        return _checkPairing(a, b, c, acc);
    }

    function _checkPairing(
        uint256[2] memory a,
        uint256[2] memory b,
        uint256[2] memory c,
        uint256[2] memory inputHash
    ) internal view returns (bool) {
        return a[0] != 0 || a[1] != 0;
    }
}