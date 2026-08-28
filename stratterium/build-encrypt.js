/**
 * build-encrypt.js
 * -----------------
 * Dijalankan LOKAL SAJA lewat: node stratterium/build-encrypt.js
 *
 * Membaca semua isi folder spesial/, menggabungkannya jadi satu payload,
 * lalu mengenkripsinya (AES-256-GCM, key dari Argon2id) jadi satu file
 * stratterium.enc.json yang aman untuk di-commit ke repo publik.
 *
 * Folder spesial/ TIDAK PERNAH ikut ter-commit — pastikan sudah ada di
 * .gitignore. Script ini sendiri boleh ikut commit, isinya cuma logika,
 * tidak ada konten atau password yang ditulis di sini.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { deriveKey } = require('../tools/argon2id');

const SPESIAL_DIR = path.join(__dirname, '..', 'spesial');
const OUTPUT_FILE = path.join(__dirname, 'stratterium.enc.json');

function readFileB64(relPath) {
  return fs.readFileSync(path.join(SPESIAL_DIR, relPath)).toString('base64');
}

function readFileText(relPath) {
  return fs.readFileSync(path.join(SPESIAL_DIR, relPath), 'utf8');
}

// prompt password dengan karakter yang diketik disamarkan jadi "*"
function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let masking = false;
    rl._writeToOutput = function (str) {
      rl.output.write(masking ? '*'.repeat(str.length) : str);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    masking = true;
  });
}

async function main() {
  console.log('=== Stratterium build-encrypt ===\n');

  if (!fs.existsSync(SPESIAL_DIR)) {
    console.error(`Folder tidak ditemukan: ${SPESIAL_DIR}`);
    console.error('Pastikan folder spesial/ tersedia di root proyek.');
    process.exit(1);
  }

  console.log(`Membaca aset dari: ${SPESIAL_DIR}`);
  const payload = {
    html: readFileText('stratterium-css-objects.html'),
    animationFramework: readFileText('animation-framework.js'),
    textEffects: readFileText('text-effects.js'),
    sceneTimeline: JSON.parse(readFileText('scene-timeline.json')),
    subtitleCues: JSON.parse(readFileText('subtitle-cues.json')),
    assets: {
      background1: readFileB64('background1.webp'),
      background2: readFileB64('background2.webp'),
      character: readFileB64('character.webp'),
      labelKertas: readFileB64('label_kertas.webp'),
    },
  };

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  console.log(`Ukuran payload sebelum enkripsi: ${(plaintext.length / 1024 / 1024).toFixed(2)} MB`);
  if (plaintext.length > 5 * 1024 * 1024) {
    console.warn('Peringatan: payload > 5MB — sessionStorage di beberapa browser membatasi sekitar segitu.');
    console.warn('Kalau nanti gagal di-load di halaman rahasia, pertimbangkan kompres ulang webp-nya.');
  }

  const password = await promptPassword('Masukkan password enkripsi: ');
  const confirm = await promptPassword('Ulangi password: ');
  if (password !== confirm) {
    console.error('\nPassword tidak cocok. Dibatalkan, tidak ada file yang ditulis.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.warn('\nPeringatan: password di bawah 8 karakter, cukup lemah untuk brute-force offline.');
  }

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12); // 96-bit, standar AES-GCM
  const key = await deriveKey(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // gabungkan ciphertext + auth tag jadi satu, ini format yang diharapkan
  // Web Crypto API (crypto.subtle.decrypt) di sisi browser
  const ciphertextWithTag = Buffer.concat([encrypted, authTag]);

  const output = {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertextWithTag.toString('base64'),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

  console.log(`\nSelesai → ${OUTPUT_FILE}`);
  console.log(`Ukuran file terenkripsi: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nLangkah selanjutnya:');
  console.log('  1. Commit stratterium/stratterium.enc.json dan tools/argon2id/argon2.umd.min.js ke repo.');
  console.log('  2. JANGAN commit folder spesial/ — cek .gitignore.');
  console.log('  3. Pastikan password di script.js (memoryForm submit) sudah pakai skema decrypt,');
  console.log('     bukan string plaintext lama.');
}

main().catch((err) => {
  console.error('\nGagal:', err.message);
  process.exit(1);
});
