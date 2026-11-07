# MANUAL provenance predicate

`hasManualProvenance(provider, rawPayload): boolean` is a dependency-free ES module.
Copy `manual.js` and `manual.d.ts` together to reuse it; no application tables,
buckets, tenant configuration, network, persistence or UI are required.

It recognizes a `manual` provider segment delimited by start/end, `_`, or `-`
(case insensitive), or PostgreSQL `jsonb ? 'manual_transcription'` semantics:
a top-level object key, an exact string array member, or an exact scalar string.
This is classification only. It does not certify document contents, canonical
transcription structure, server receipt verification, actor identity or permission.
Canonical new MANUAL schemas may require a stricter exact provider identifier.

`manual-provenance.corpus.json` contains synthetic cross-language parity cases;
the backend/SQL and frontend tests consume it without cloud access.
