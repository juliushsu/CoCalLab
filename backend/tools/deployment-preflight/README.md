# Fixed-source Deno preflight

This tool only reads Git objects for `ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`, copies 46 code files into the dedicated workspace tooling directory, caches public module dependencies, and invokes native Deno analysis commands. It never imports/executes an application handler, uses `deno run/serve`, reads `.env`, logs into Supabase, starts Docker, or deploys. It does not modify the application source or PATH.

Required local assets: the owner-approved Supabase CLI 2.122.1 and Deno 2.9.8 Windows ZIPs/binaries under `../tooling/deployment-20261107`. Both archive and binary SHA256 are checked before execution. Node 24.22.1 and the existing frontend TypeScript 5.8.3 parser were used for orchestration/AST inventory, not as a substitute for Deno. Git is invoked through PATH without a shell. The tool does not install dependencies or download these binaries itself.

```powershell
node --test backend/tools/deployment-preflight/graph.test.mjs
node backend/tools/deployment-preflight/verify.mjs inventory
node backend/tools/deployment-preflight/verify.mjs all
node backend/tools/deployment-preflight/summarize.mjs
```

`inventory` writes `inventory.json` and preserves the completed manifest. `all` resolves a dependency-only cache/lock first (a failed `deno check` does not write the needed lock), then runs separate `deno check --all --cached-only --frozen-lockfile`, `deno info`, and `deno bundle --frozen-lockfile`. `verify` omits mutable dependency discovery and requires the saved lock/cache. All native commands and read-only Git commands have a 30-second timeout. The compiler can download public dependencies; no runtime permissions are granted. CLI startup uses a dedicated `SUPABASE_HOME`; Deno cache uses a dedicated `DENO_DIR`, with no credential environment copied to child tools.

Evidence is in `docs/delivery/evidence/deployment-preflight-20261107/`: `manifest.json`, `commands.json`, `deno.lock`, `failure-summary.json`, `RESULTS.md`, and sanitized per-function compiler logs. Large bundles, source maps, fixed source copies, and caches remain outside Git under the tooling directory. The offline summarizer rehashes all sources, tools, bundles/maps, and lock without invoking Deno or the network; this is the appropriate command for evidence review.

Observed result: **0/14 native type checks pass; 14/14 static ESM bundles created**. Compilation without type checking is the native bundle default; success is not deployment acceptance. Shared SDK 2.49.4 emits remote TS2303 errors. The floating `create-organization` SDK `@2` resolves to 2.119.0 in this lock and emits remote TS2304/TS2552 errors. Nine additional diagnostics are in the fixed local source: workspace/legal_entity/site inference in generate-report, and caught-error property access in delete/verify-upload handlers. Errors are retained, not suppressed or fixed.

Bundles retain Node built-in imports. Managed Edge compatibility, ESZIP packaging and live execution are **NOT_RUN**. Reference edge-runtime v1.78.1 embeds Deno 2.1.4/deno_core 0.324.0, unlike the local checker 2.9.8; managed actual version is UNKNOWN. Original TS re-resolved without this frozen lock/artifact remains BLOCKED. No production approval follows from these artifacts.
