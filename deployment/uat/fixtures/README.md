# Synthetic native chooser fixtures

These two checked-in images were authored locally on 2026-11-08 with Windows System.Drawing (900x360 white bitmap, Arial text), then decoded and visually inspected. They contain only invented test data: SYNTHETIC UAT ONLY, electricity 100 kWh, January 2026. They are not invoices or OCR results. No external provider or enterprise data was used.

The portable Node generator copies their exact checked-in bytes; System.Drawing/fonts are not runtime dependencies. SHA256, byte sizes and expected results are in the generated manifest and the versioned UAT preparation evidence. Do not regenerate or silently replace existing bytes during acceptance. Changes need a new fixed manifest/version.

From repo root: `node deployment/uat/prepare-manual-fixtures.mjs --candidate`. Output is the dedicated workspace tooling/manual-fixtures-20261108 directory outside Git. PDF/PNG/JPEG are positive chooser inputs; empty, invalid, misleading-extension and >10MiB files are explicit negative inputs. No files are uploaded by this command. The PNG disguised as PDF has identical bytes to the positive PNG; test each negative in a fresh dedicated scope without an existing matching receipt so deduplication does not mask validation.
