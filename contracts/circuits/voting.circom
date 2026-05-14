pragma circom 2.0.0;

template VotingCircuit() {
    signal input proposalId;
    signal input nullifierHash;
    signal input scope;

    signal input identityTrapdoor;
    signal input identityNullifier;
    signal input secret;

    signal input treePathIndices[16];
    signal input treePathElements[16];

    component identityCommit = Poseidon(2);
    identityCommit.inputs[0] <== identityTrapdoor;
    identityCommit.inputs[1] <== identityNullifier;

    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== identityNullifier;
    nullifier.inputs[1] <== proposalId;
    nullifier.inputs[2] <== secret;

    nullifierHash === nullifier.out;

    signal hash[17];
    hash[0] <== identityCommit.out;

    for (var i = 0; i < 16; i++) {
        component hasher = Poseidon(2);
        if (treePathIndices[i] == 0) {
            hasher.inputs[0] <== hash[i];
            hasher.inputs[1] <== treePathElements[i];
        } else {
            hasher.inputs[0] <== treePathElements[i];
            hasher.inputs[1] <== hash[i];
        }
        hash[i+1] <== hasher.out;
    }

    hash[16] === scope;
}

component main {public [proposalId, nullifierHash, scope]} = VotingCircuit();