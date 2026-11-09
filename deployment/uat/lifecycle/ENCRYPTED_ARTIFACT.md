# Encrypted artifact interface v1

`encrypted-artifact.mjs` is a portable, local-file primitive using only Node 24 built-ins.
It has no CoCalLab table, customer, tenant, bucket, provider, URL or deployment default.
Each product supplies its own protected directories, random key, scope binding and trusted manifest.
No dependencies are installed; copy the module, tests and this document together and pin the reviewed Git version.
The first real usage is the explicitly synthetic Owner delivery adapter beside this module; no central API is introduced.

```js
import {randomBytes} from 'node:crypto';
import {encryptArtifact, decryptArtifact} from './encrypted-artifact.mjs';
const key = randomBytes(32); // Supply/recover securely; never print or commit it.
const binding = JSON.stringify({product: 'SYNTHETIC', tenant: 'SYNTHETIC-A',
  ref: 'SYNTHETIC-REF', lease: 'SYNTHETIC-LEASE', sourceSHA: 'SYNTHETIC-SOURCE'});
const expected = await encryptArtifact({source: '/protected/prepared.bin',
  destination: '/protected/new-archive.eaf', key, binding});
await decryptArtifact({source: '/protected/new-archive.eaf',
  destination: '/protected/new-readback.bin', key, binding, expected});
```

These paths are examples, not directories created automatically. The caller must validate
directory ownership/ACLs first, supply the same exact binding during recovery, and protect
the manifest against replacement. SHA256 alone does not authenticate an untrusted manifest.
Use a unique key per real batch. Key management, archival packing, remote transport,
distributed locks and authorization remain product/provider adapters.

Format: four bytes `EAF1`, random 12-byte nonce, AES-256-GCM ciphertext, 16-byte tag.
The scope binding is authenticated additional data; its SHA256 is returned in the manifest.
The result includes plaintext length, plaintext SHA256 and entire encrypted-file SHA256.
Default/maximum plaintext size is 1 GiB; `maxBytes` may lower it. Larger backups must fail
before provisioning or require an explicit compatible design/estimate; there is no silent truncation.

Encryption and decryption stream 64 KiB blocks. Plaintext remains in a unique protected
`.incomplete-*` quarantine until authentication, trusted digests and source stability pass.
Publication uses a same-directory hard link with create-only semantics, never replacing an
existing destination. Hard-link support is required (observed on this PC's NTFS); future
Railway filesystem support is NOT_RUN. No fallback to overwrite/unsafe rename exists.
Temporary files created by this invocation are removed on ordinary failures. A killed process
may leave an incomplete file; it is never a valid backup. Do not automatically delete unknown
incomplete files or real archives. Reconcile against the original operation before retrying.

Errors expose static codes: `INVALID_*`, `TRUSTED_MANIFEST_REQUIRED`,
`SIZE_LIMIT_OR_INVALID_ARTIFACT`, `LINKED_PARENT_REFUSED`, `NON_REGULAR_SOURCE`,
`SOURCE_CHANGED`, `TRUNCATED_ARTIFACT`, `AUTHENTICATION_FAILED`, `MANIFEST_MISMATCH`,
`DESTINATION_EXISTS`, `FILE_IO_FAILED`. A failed publication response can require checking
the exact destination; never choose a new operation ID to conceal an ambiguous result.
No operation promises cross-service atomicity, offsite retention or database restoration.

## Windows Owner adapter

`test-owner-delivery.ps1` validates the explicitly supplied local application roots, rejects
junctions, preserves existing files/ACLs, checks free space, and creates a uniquely named
`SYNTHETIC-PROBE-*` directory with only current Owner/SYSTEM full control. Existing roots
with unexpected ACLs cause refusal instead of broad permission changes. Node's `mode:0600`
is not used as proof of Windows ACL enforcement. The adapter checks actual file ACLs too.

`owner-delivery-probe.mjs` creates only labelled synthetic bytes, a separate random key,
encrypted file, manifest and readback. It rereads the key, compares bytes/digests, tests
wrong key/tampering/refused overwrites, and retains all probe batches. Every manifest has
actual UAT ref `null`; it cannot certify real DB/private-ledger/proof/Storage/settings restore,
Owner acceptance, an independent backup location, or permission to delete a cloud backup.

Run tests: `node --test deployment/uat/lifecycle/encrypted-artifact.test.mjs`.
Windows adapter invocation requires the already Owner-approved exact roots and actual
Owner account; do not substitute a sandbox account or expose the key in a command/log.
Future product adapters can replace transport/storage independently; updates never deploy
or modify another product. v1 is a new format; no legacy backups are rewritten.

Sources: [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html),
[Node filesystem](https://nodejs.org/docs/latest-v24.x/api/fs.html).
