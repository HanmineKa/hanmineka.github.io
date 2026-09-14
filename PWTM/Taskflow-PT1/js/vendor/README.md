# Vendor files (belum ada)

Folder ini harus diisi `sql-wasm.js` dan `sql-wasm.wasm` dari package
`sql.js` sebelum `index.html` bisa berjalan.

**A. Lewat npm:**
```bash
npm install sql.js
cp node_modules/sql.js/dist/sql-wasm.js .
cp node_modules/sql.js/dist/sql-wasm.wasm .
```

**B. Download langsung dari:**
https://github.com/sql-js/sql.js/releases — ambil `sql-wasm.js` dan
`sql-wasm.wasm` dari rilis terbaru, taruh di folder ini.
