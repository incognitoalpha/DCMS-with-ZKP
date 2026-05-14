pragma circom 2.0.0;

template ReputationCircuit() {
    signal input threshold;
    signal input commitment;

    signal input secret;
    signal input score;

    component commitmentHash = Poseidon(2);
    commitmentHash.inputs[0] <== secret;
    commitmentHash.inputs[1] <== score;

    commitment === commitmentHash.out;

    component gte = GEq(32);
    gte.in[0] <== score;
    gte.in[1] <== threshold;

    gte.out === 1;
}

template GEq(n) {
    signal input in[2];
    signal output out;

    component num2bits = Num2Bits(n+1);
    num2bits.in <== in[0] - in[1] + (1 << n);

    out <== 1;
}

component main {public [threshold, commitment]} = ReputationCircuit();