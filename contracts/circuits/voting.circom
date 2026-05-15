pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

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

    component hashers[16];
    for (var i = 0; i < 16; i++) {
        hashers[i] = Poseidon(2);
        
        hashers[i].inputs[0] <== hash[i] - treePathIndices[i] * (hash[i] - treePathElements[i]);
        hashers[i].inputs[1] <== treePathElements[i] + treePathIndices[i] * (hash[i] - treePathElements[i]);
        
        hash[i+1] <== hashers[i].out;
    }

    hash[16] === scope;
}

component main {public [proposalId, nullifierHash, scope]} = VotingCircuit();