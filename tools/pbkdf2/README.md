# PBKDF2 tool

Reusable PBKDF2 helper for obfuscated static-page assets. The reconstruction logic is `key-fragments-core.js`; the browser orchestrator is `crypto-client.js`.

The shared parameters are 250,000 iterations, SHA-256, and a 256-bit AES-GCM key. Keep these values identical wherever the encrypted payload is opened.

No install needed — both files use only the browser's built-in Web Crypto API, no dependencies.
