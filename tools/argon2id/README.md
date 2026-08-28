# Argon2id WASM tool

Reusable Argon2id helper for local Node build scripts and static browser pages.
The browser bundle is `argon2.umd.min.js`; the Node helper is `index.js`.

The shared parameters are 3 iterations, 64 MiB memory, one lane, and a 32-byte
output. Keep these values identical wherever the encrypted payload is opened.

Install the Node dependency from this directory with `npm install`.