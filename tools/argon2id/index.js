const { argon2id } = require('hash-wasm');

const ARGON2ID_OPTIONS = Object.freeze({
  iterations: 3,
  memorySize: 65536,
  parallelism: 1,
  hashLength: 32,
  outputType: 'binary',
});

async function deriveKey(password, salt) {
  return argon2id({
    ...ARGON2ID_OPTIONS,
    password,
    salt,
  });
}

module.exports = { ARGON2ID_OPTIONS, deriveKey };