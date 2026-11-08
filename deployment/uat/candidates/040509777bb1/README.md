# Correction provenance / draft lock-order candidate

Product `040509777bb1cb60589a01ce7ec176a4ec54cee7`, PR35. RELEASE HOLD; target ref=null. This prepares an execution proposal, not authorization to create a project/bucket, deploy, apply cloud SQL or alter existing migration history.

The manifest hashes all 49 Git source migrations: 46 schema/governance and three historical fixture DML held. Native R1 tests applied all46 to a fresh dedicated local database; PGlite tests are separately labelled. Order: existing migrations →202611080001→002 provenance→003 ordinary-draft early project lock. NOT VALID constraints need individual catalog/data validation; successful application is not historical data verification.

No new Edge function: recover uses the existing replace-emission-activity handler, fresh JWT actor and service-only RPC. Deploy SQL/handler/builder/UI as one candidate. Preserve private hash, recalculation, report proof, MANUAL and replacement ledgers in backup. Database backup does not include Storage bytes or generations. PR34's da5 local restore evidence has not been repeated for the two new migrations.

**Existing projects must explicitly recalculate before new reports; old in-flight recalculation may fail.** No automatic recalc, historical latest-flag mutation, resealing or report overwrite. Old sealed request replay stays original. Old handler payloads with corrected activities but missing authoritative disclosure fail closed; a client-only rollback is not a compatibility plan.

Settings retain the existing16 gateway JWT checks, exact planned UAT4211 Auth redirects/CORS, CLI2.122.1/Deno2.9.8 and disabled Mock/provider proposal. Reuse the byte-identical full config and original parser receipt under ../ed6ca9bbfbc5/. That parser ran for ed6, not this candidate. The16 native static checks/bundles ran for99c233d; source-equivalence.json proves all JS/TS/FE/modules byte-equivalent to040. Managed Edge/ESZIP/runtime remains NOT_RUN; never turn off JWT or widen CORS to bypass a failure.

Separate synthetic preview:4217 frontend /4216 API, not the planned real UAT4211. Its factor1 and fake Auth/Storage are test adapters only. Existing5432, other previews and cloud main remain unchanged. No costs/retention clock started. See docs/delivery/REPLACEMENT_PROVENANCE_FIX_DELIVERY_20261108.md and the narrow Claude review entry.
