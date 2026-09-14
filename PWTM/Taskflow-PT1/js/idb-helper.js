/**
 * idb-helper.js
 * -------------
 * Wrapper tipis di atas IndexedDB native untuk menyimpan bytes database
 * SQLite (hasil sql.js `db.export()`) sebagai lapisan persistensi.
 *
 * Dipilih dibanding OPFS karena GitHub Pages tidak bisa set header
 * Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy yang
 * dibutuhkan OPFS.
 *
 * Tidak ada dependency eksternal — murni IndexedDB API bawaan browser.
 */

const DB_NAME = 'taskflowStorage';
const DB_VERSION = 1;
const STORE_NAME = 'sqliteFile';
const KEY = 'main';

/**
 * @returns {Promise<IDBDatabase>}
 */
function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Simpan bytes database (Uint8Array dari db.export()) ke IndexedDB.
 * @param {Uint8Array} bytes
 * @returns {Promise<void>}
 */
export async function saveDbBytes(bytes) {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bytes, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Ambil bytes database dari IndexedDB.
 * @returns {Promise<Uint8Array|null>} null kalau belum pernah disimpan
 */
export async function loadDbBytes() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Hapus data tersimpan — dipakai untuk fitur "Reset ke Default".
 * @returns {Promise<void>}
 */
export async function clearDbBytes() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
