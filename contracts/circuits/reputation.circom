pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template ReputationCircuit() {
    signal input threshold;
    signal input commitment;

    signal input secret;
    signal input score;

    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== secret;
    commitmentHash.inputs[1] <== score;

    commitment === commitmentHash.out;

    component gte = GreaterEqThan(32);
    gte.in[0] <== score;
    gte.in[1] <== threshold;

    gte.out === 1;
}

component main {public [threshold, commitment]} = ReputationCircuit();