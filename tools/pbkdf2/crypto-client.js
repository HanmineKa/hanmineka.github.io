/**
 * crypto-client.js
 * -----------------
 * Orchestrator GENERIC untuk proyek "pbkdf2": rakit seed dari fragmen,
 * derive AES-256 key via PBKDF2 (Web Crypto API bawaan, tanpa WASM
 * tambahan), lalu decrypt payload.
 *
 * Ringan & cukup untuk konten yang TIDAK terlalu penting. Untuk proyek
 * penting (proteksi lebih berat), pakai tools/argon2id, bukan file ini.
 *
 * File ini dipakai bersama key-fragments-core.js dan sebuah keycfg.js
 * milik masing-masing proyek (berisi fragmen unik proyek itu).
 */

import { reconstructSeed } from "./key-fragments-core.js";

const PBKDF2_ITERATIONS = 250_000; // harus sama dengan yang dipakai saat build-encrypt

/**
 * Derive AES-256-GCM key dari seed + salt via PBKDF2.
 * @param {string} seed
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(seed, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(seed),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

/**
 * Ambil file .enc.json, rakit seed dari fragmen proyek, decrypt payload-nya.
 *
 * @param {string} url - path ke file terenkripsi, mis. "./anim-2.enc.json"
 * @param {import("./key-fragments-core.js").Fragment[]} fragments - fragmen
 *   unik milik proyek ini (dari keycfg.js proyek tsb).
 * @returns {Promise<Uint8Array>} bytes hasil dekripsi (mentah — silakan
 *   diproses lagi sesuai kebutuhan: JSON.parse, instantiate wasm, dst)
 */
export async function loadEncryptedAsset(url, fragments) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal fetch ${url}: ${res.status}`);
  const { salt, iv, ciphertext } = await res.json();

  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const seed = reconstructSeed(fragments);
  const aesKey = await deriveKey(seed, saltBytes);

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivBytes }, aesKey, ciphertextBytes);
  } catch (err) {
    throw new Error("Dekripsi gagal — fragmen seed tidak cocok atau file rusak.");
  }

  return new Uint8Array(plaintext);
}

/**
 * Helper: decrypt lalu langsung parse sebagai JSON (kasus umum untuk
 * payload gabungan seperti pola Stratterium: html + js + assets base64).
 *
 * @param {string} url
 * @param {import("./key-fragments-core.js").Fragment[]} fragments
 * @returns {Promise<any>}
 */
export async function loadEncryptedJSON(url, fragments) {
  const bytes = await loadEncryptedAsset(url, fragments);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}
