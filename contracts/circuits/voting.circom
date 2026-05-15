pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template VotingCircuit() {
    signal input proposalId;
    signal input nullifierHash;
    signal input scope;

    signal input identityTrapdoor;
    signal input identityNullifier;
    signal input secret;

    component identityCommit = Poseidon(2);
    identityCommit.inputs[0] <== identityTrapdoor;
    identityCommit.inputs[1] <== identityNullifier;

    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== identityNullifier;
    nullifier.inputs[1] <== proposalId;
    nullifier.inputs[2] <== secret;

    nullifierHash === nullifier.out;
    identityCommit.out === scope;
}

component main {public [proposalId, nullifierHash, scope]} = VotingCircuit();
