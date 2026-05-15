const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const circuits = ['voting', 'booking', 'reputation'];
const buildDir = path.join(__dirname, '../circuits/build');
const contractsDir = path.join(__dirname, '../contracts');
const frontendZkDir = path.join(__dirname, '../../frontend/public/zk');

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
if (!fs.existsSync(frontendZkDir)) fs.mkdirSync(frontendZkDir, { recursive: true });

function run(cmd) {
    console.log(`Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '../') });
}

// 1. Generate Powers of Tau (shared for all circuits)
const ptau = 'pot14_final.ptau';
if (!fs.existsSync(path.join(buildDir, ptau))) {
    run(`npx snarkjs powersoftau new bn128 14 circuits/build/pot14_0000.ptau -v`);
    run(`npx snarkjs powersoftau contribute circuits/build/pot14_0000.ptau circuits/build/pot14_0001.ptau --name="First" -v -e="random"`);
    run(`npx snarkjs powersoftau prepare phase2 circuits/build/pot14_0001.ptau circuits/build/${ptau} -v`);
}

for (const name of circuits) {
    console.log(`\n--- Building ${name} ---`);
    // Compile circom
    run(`.\\circom.exe circuits/${name}.circom --r1cs --wasm --sym -o circuits/build`);

    // Setup Groth16
    const r1cs = `circuits/build/${name}.r1cs`;
    const zkey0 = `circuits/build/${name}_0000.zkey`;
    const zkeyFinal = `circuits/build/${name}_final.zkey`;

    run(`npx snarkjs groth16 setup ${r1cs} circuits/build/${ptau} ${zkey0}`);
    run(`npx snarkjs zkey contribute ${zkey0} ${zkeyFinal} --name="Second" -v -e="random"`);

    // Export Verification Key
    const vkey = `circuits/build/${name}_verification_key.json`;
    run(`npx snarkjs zkey export verificationkey ${zkeyFinal} ${vkey}`);

    // Export Solidity Verifier
    const solFile = `circuits/build/${name}Verifier.sol`;
    run(`npx snarkjs zkey export solidityverifier ${zkeyFinal} ${solFile}`);

    // Read generated Solidity file and rename the contract from 'Groth16Verifier'
    const Capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    let solContent = fs.readFileSync(path.join(__dirname, '../', solFile), 'utf8');
    solContent = solContent.replace('contract Groth16Verifier', `contract ${Capitalized}Verifier`);
    
    // Write back to contracts dir
    fs.writeFileSync(path.join(contractsDir, `${Capitalized}Verifier.sol`), solContent);

    // Copy wasm and zkey to frontend
    const wasmSrc = path.join(buildDir, `${name}_js`, `${name}.wasm`);
    fs.copyFileSync(wasmSrc, path.join(frontendZkDir, `${name}.wasm`));
    fs.copyFileSync(path.join(__dirname, '../', zkeyFinal), path.join(frontendZkDir, `${name}_final.zkey`));
    fs.copyFileSync(path.join(__dirname, '../', vkey), path.join(frontendZkDir, `${name}_vkey.json`));
}

console.log("Done building circuits!");
