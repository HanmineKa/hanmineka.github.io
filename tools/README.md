# tools

Encryption utilities for assets used across projects in this repo. Pick
the folder based on how much resistance to casual access the content
needs:

| Folder | Tier | Method |
|---|---|---|
| `argon2id/` | Higher-assurance | Argon2id (memory-hard, more resistant to offline/GPU cracking, requires WASM) |
| `pbkdf2/` | Standard | PBKDF2 + obfuscated key fragments (lightweight, native Web Crypto API, no extra WASM) |

Both produce the same `.enc.json` format (`salt` + `iv` + `ciphertext`,
base64) and run entirely client-side — suited for static hosting (e.g.
GitHub Pages) with no backend.

**Note:** both tiers are obfuscation, not real cryptographic protection
against a determined attacker — the algorithm, parameters, and key
material all ultimately live in public client code. The difference is
the amount of effort required to reverse it, not whether it's possible.
Use `argon2id/` when that extra effort matters more; `pbkdf2/` is enough
to keep casual visitors from viewing content without any effort.

See each folder's README/USAGE for details.
