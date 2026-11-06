# Portable file verification 1.0.0

Independent ES module, Node 24+ / Web API compatible runtime (Deno execution NOT_RUN). No explicit redistribution license is present in this repository; this delivery does not grant a new external license. Internal product reuse follows the CTO architecture directive. No dependencies beyond Web Crypto, Blob, ReadableStream and AbortController. Not a central API; each product runs its own copy/configuration. No UI, carbon rules, table, customer, tenant, bucket, credential or deployment default lives in the core.

## Interface

verifyStoredFile({ storage, reference, expected: { size, mimeType }, maxBytes, timeoutMs, signal }) returns { sha256, size, mimeType, moduleVersion }. sha256 is computed from bounded original bytes, not a caller hash. The default maximum is 10485760 bytes and read timeout is 15000ms. MIME accepts application/pdf, image/png, image/jpeg (image/jpg canonicalized). The opaque reference is passed only to the injected storage adapter; the module cannot choose a product scope or credential.

storage.read(reference, { signal }) returns { body, mimeType, contentLength }. body may be Uint8Array, Blob or ReadableStream<Uint8Array>; contentLength may be null when absent. Advertised length does not bypass the actual read bound. Adapters must honor cancellation when possible. Errors are FileVerificationError with code for size/length/MIME/signature/read/timeout/abort; callers must preserve an uncertain reference and must not manufacture a successful hash.

## Product adapter and example

CoCalLab uses backend/src/adapters/supabase-private-file.js with injected { url, serviceKey, fetchImpl }. Its service reserves and authorizes a specific object before calling the core, then rechecks that binding on receipt commit. Those product rules are not portable module defaults. Do not copy project credentials or bucket names to another product.

A product-provided adapter can use this configuration shape (placeholders only):

    const storage = {
      async read(reference, { signal }) {
        return myAuthorizedStorage.read(reference, { signal });
      }
    };
    const result = await verifyStoredFile({
      storage,
      reference: myProductAuthorizedOriginal,
      expected: { size: measuredMetadataSize, mimeType: canonicalMetadataMime },
      maxBytes: 10485760,
      timeoutMs: 15000,
      signal: request.signal
    });

Each product supplies authorization, tenant/product boundary, original generation binding, cache/journal scope and durable idempotency. The core does not establish any of these. It reads full bounded content into memory to use Web Crypto; memory overhead is several copies up to the configured cap. Size this limit and concurrent request capacity per product. HTTP response redirects are refused by the example product adapter.

## Verify and port

From repo root: node --test backend/tests/file-verification.test.js. Fixtures are marked synthetic. Coverage includes bytes/Blob/stream SHA, actual size bounds despite false/missing content length, MIME/signature, interrupted/timeout/late reads and malformed product input. Server-side receipt/RLS integration tests are product-owned, under backend/tests/integration/attachment-verification-*.test.js.

Copy this directory with the product adapter interface and tests; provide the target project's own storage provider/configuration and credentials securely. Pin module version in that product and run the tests in its actual runtime. Another product decides independently when to upgrade; this does not deploy or mutate any other product. A second real consumer may justify a versioned package later, not a platform rewrite now.

SHA-256 and basic file headers do not verify business truth, fully parse file format or scan malware. No OCR or external provider is invoked. Real Supabase/Deno execution, independent SQL lock races, cloud deployment and service-role maintenance guarantees remain NOT_RUN; no costs or data egress authorized.
