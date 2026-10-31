# Claude PR #3 review — CTO ruling and H3 authorization

2026-10-31; freeze baseline `90f1ead1b9ef39a41c17d6342aadc4c1b8f99c09`.

Intake is the owner's six-finding summary of Claude's read-only review. The Windows-local original and its 28 source links were not available in this runtime; this is not a reproduction of Claude's full report. Codex independently checks public source and synthetic local runtime evidence. Claude reported tests NOT_RUN; subsequent Codex test results are separate evidence.

**Ruling: HOLD for release.** No demonstrated navigation elevation or direct identity-guard bypass does not establish end-to-end acceptance. Existing findings remain release dependencies; their age does not waive them.

| Finding | CTO disposition | Owner / authorized next action |
| --- | --- | --- |
| F1: failed remote sign-out can restore persisted session on reload | Accept as H2 regression. SDK early error returns before local removal; in-memory sign-out latch cannot survive reload. | Codex A: persistent app-specific local logout fence, real SDK/storage reload tests, visible remote-revocation failure. Do not clear unrelated business storage or claim remote token invalidation. |
| F2: project legal entity/site tenant binding | Independently confirmed using source and isolated SQL. An ID FK alone does not bind tenant identity. | Codex B: minimum same-workspace integrity enforcement; preserve nullable links; protect reference changes too. No additional same-legal-entity business rule without authority. |
| F3: child project/organization mismatch | Independently confirmed for documents and activities; evaluate the remaining applicable tables with precise evidence. This proves inconsistent writes, not successful cross-tenant content theft. | Codex B: enforce project/organization pairing with additive constraints; preserve org-wide null project references and existing deletion semantics. No automatic repair of old data. |
| F4: privileged RPC caller/grant boundary | High priority; source cold-start checks must distinguish effective PUBLIC grants from live catalog privileges. | Codex C: identify final function signatures and actual callers, revoke general execution only for verified Edge-only atomic RPCs, keep service-role path and legitimate client RPCs. Test direct denial with non-bypass roles. |
| F5: UUID lookup information exposure | Independently confirmed in isolated PostgreSQL: an anonymous role denied table rows could invoke a known-project lookup. Live API exposure remains unverified. | Codex C: restrict only the three existing ID lookup helpers to service_role, preserving membership-aware functions and legitimate client RPCs; test both denied callers and RLS regressions. |
| F6: uppercase UUID role lookup failure | Treat as functional regression, not privilege elevation. | Codex A: canonicalize UUID comparisons and returned scope identifiers; retain alias/conflict checks and add regression tests. |

## Boundaries and closure

H3 may change source, add migrations and run synthetic isolated tests. It may not inspect or change production credentials, apply cloud migrations, rewrite historical customer data, merge release branches or deploy. Persist findings and tests on a feature PR based on PR #3. Ordinary implementation continues without repeating H0.

For each finding require baseline, changed paths, exact test command/result and remaining gaps. A source fix is not live remediation. Before any actual database rollout, inspect existing inconsistent data and effective ACLs in an authorized environment; obtain a data-resolution plan rather than silently deleting, moving or rewriting historical records.

Independent code/SQL review follows implementation. Return the fixed version to Claude for regression review of F1–F6. Browser sign-out/reload, real JWT/Storage/RPC access, full migration-chain validation, business UAT and owner release approval remain separate gates. No fake PASS, no fixture fallback and no service-role test presented as customer authorization.

## H3 implementation evidence

- F1/F6: `authPersistence.ts`, `AuthProvider.tsx`, `lib/supabase.ts`, navigation scope/service. The installed SDK was exercised with offline fetch and shared storage: original logout failure retains a token; fenced logout prevents restoration after a fresh client load; failed login does not remove the fence; confirmed new login can persist; unavailable storage is not presented as durable success. UUID case normalization does not bypass alias conflicts.
- F4: `202610310003_atomic_rpc_service_role_only.sql` and `atomic-rpc-privilege-rls.test.js`. Six exact Edge-only atomic signatures lose PUBLIC/anon/authenticated execution. The suite reproduces a direct anonymous write before the fix and verifies permission denial afterward, service-role success and unchanged legitimate member/create-org RPC ACLs.
- F2/F3: `202610310004_tenant_relationship_integrity.sql` and `tenant-relationship-integrity.test.js`. Sixteen NOT VALID composite FKs bind 13 child tables to project tenants and bind the three boundary relationships. Existing inconsistent rows are not repaired or validated. Nullable references, project-only SET NULL and cascade semantics are preserved. Reference-side tenant changes cannot invalidate valid bindings, including maintenance-role writes. Same-tenant cross-project document reuse is not restricted.
- F5: `202610310005_project_lookup_acl.sql` and `project-lookup-privilege-rls.test.js`. The three ID lookup helpers become service-only; tests retain membership-aware helper, direct-table and security-invoker-view RLS behavior.
- Independent agents reviewed ACL scope and relational constraints. This is Codex review following Claude's report; it is not Claude re-review.

Run unit checks with `npm test --prefix backend` and `npm test --prefix frontend/readdy-app`; type/lint/build from the frontend package. Run isolated SQL with `PGLITE_RUNTIME_ROOT=<isolated-prefix> node --test --test-concurrency=1 backend/tests/integration/*.test.js`. CI uses the same SQL glob, excluding the separate migration diagnostic script.

Before rollout: PostgreSQL 15+ is required by column-specific SET NULL; confirm the real server version, effective grants, existing inconsistent rows and index/DDL lock budget. NOT VALID constraints protect new relationship-key writes, not a claim that historic rows are consistent. A controlled validation/data-resolution plan and actual environment tests remain required. **All six findings have source remediation candidates; release remains HOLD until the remaining environment and acceptance gates close.**
