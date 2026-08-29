# pbkdf2 usage

Per-project seed fragments are not stored in this folder — place them
in each project's own `keycfg.js`, not here.

## New project setup

1. Generate a random seed (32+ characters), split it into a few
   fragments using a different pattern per project. Example
   `keycfg.js`:
   ```js
   // anim-2/keycfg.js
   export const fragments = [
     { order: 2, value: "bXVoNzJr", encoding: "base64" },
     { order: 0, value: "6b6c7a3e91", encoding: "hex" },
     { order: 1, value: "dlrow-olleh", encoding: "reverse" },
   ];
   ```
   `order` sets the reconstruction order (fragments can be written
   out of sequence so they don't read as one obvious block).

2. Use the same reconstructed seed as input to `build-encrypt.js` at
   build time (locally, Node) to produce the project's `.enc.json`.

3. Load and decrypt in the browser:
   ```js
   import { loadEncryptedJSON } from "../tools/pbkdf2/crypto-client.js";
   import { fragments } from "./keycfg.js";

   button.addEventListener("click", async () => {
     const payload = await loadEncryptedJSON("./anim-2.enc.json", fragments);
   });
   ```

Each project should use a different seed and fragment-splitting
pattern, so a leak in one project doesn't compromise the others.
