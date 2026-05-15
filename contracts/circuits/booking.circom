pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template BookingCircuit() {
    signal input commitment;
    signal input nullifier;
    signal input resourceId;
    signal input startTime;
    signal input endTime;

    signal input secret;
    signal input bookingNonce;

    component bookingHash = Poseidon(5);
    bookingHash.inputs[0] <== secret;
    bookingHash.inputs[1] <== resourceId;
    bookingHash.inputs[2] <== startTime;
    bookingHash.inputs[3] <== endTime;
    bookingHash.inputs[4] <== bookingNonce;

    commitment === bookingHash.out;

    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== secret;
    nullifierHash.inputs[1] <== bookingNonce;

    nullifier === nullifierHash.out;
}

component main {public [commitment, nullifier, resourceId, startTime, endTime]} = BookingCircuit();