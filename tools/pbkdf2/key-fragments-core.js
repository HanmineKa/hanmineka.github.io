/**
 * key-fragments-core.js
 * ----------------------
 * Logika GENERIC untuk merakit ulang "seed" dari beberapa potongan yang
 * disamarkan. File ini TIDAK berisi data rahasia apa pun — cuma cara
 * memprosesnya. Data fragmen yang sebenarnya (unik per proyek) ditaruh
 * di folder proyek masing-masing, bukan di sini.
 *
 * Ini BUKAN enkripsi sungguhan — cuma menaikkan effort orang yang mau
 * baca key secara sekilas dari source code. Siapa pun yang niat taruh
 * breakpoint sebelum crypto.subtle.decrypt tetap bisa lihat hasil akhirnya.
 */

/**
 * Satu potongan fragmen.
 * @typedef {Object} Fragment
 * @property {string} value - Data potongan (sudah di-encode).
 * @property {"raw"|"base64"|"reverse"|"hex"} encoding - Cara decode potongan ini.
 */

/**
 * Decode satu fragmen sesuai encoding-nya.
 * @param {Fragment} fragment
 * @returns {string}
 */
function decodeFragment({ value, encoding }) {
  switch (encoding) {
    case "raw":
      return value;
    case "base64":
      return atob(value);
    case "reverse":
      return value.split("").reverse().join("");
    case "hex": {
      let out = "";
      for (let i = 0; i < value.length; i += 2) {
        out += String.fromCharCode(parseInt(value.substr(i, 2), 16));
      }
      return out;
    }
    default:
      throw new Error(`Encoding fragmen tidak dikenal: ${encoding}`);
  }
}

/**
 * Gabungkan beberapa fragmen jadi satu seed string, sesuai urutan index
 * yang diberikan (bukan urutan array) — supaya penyusunan fisik di file
 * konfigurasi proyek boleh diacak, tidak harus berurutan.
 *
 * @param {Fragment[]} fragments - Potongan-potongan, masing-masing dengan
 *   properti tambahan `order` (angka) yang menentukan urutan penggabungan.
 * @returns {string} seed hasil gabungan
 */
export function reconstructSeed(fragments) {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    throw new Error("reconstructSeed butuh minimal 1 fragmen.");
  }

  const sorted = [...fragments].sort((a, b) => a.order - b.order);
  return sorted.map(decodeFragment).join("");
}
