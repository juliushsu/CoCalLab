# Full PR #4 report: supplemental CTO intake

2026-10-31. The owner supplied the full Markdown review of `8b8b444b3313bc169c7c8fc479f03d8ffffb678c`, previously available only as a summary. This intake adds observations O1/O2; it does not reopen source-closed F1–F6 or supersede the N1/N2 ruling. N1 was corrected in PR #5; N2 remains accepted with boundaries.

The attachment is a source-review report, not the requested Cloudflare/Supabase resource inventory. Actual account plan/usage, CoCalLab project purpose/data and permitted cloud mutation scope remain unverified. No resource is created or modified by this intake.

## O1: accepted source finding; bounded remediation

`202603180006_v1_staging_hardening_followup.sql` allows SELECT of action logs with null organization_id. The existing organization FK uses SET NULL. When applicable table SELECT grants exist, anonymous or unrelated users can consequently read orphaned/system log rows. The live grants and actual metadata remain unverified; do not present source behavior as demonstrated cloud data exposure.

Authorize one incremental policy migration restricting ordinary client reads to active membership in a non-null organization. Preserve retention/deletion semantics and service-role operational access; do not delete logs or grant new writes. Require a synthetic PostgreSQL reproduction before correction, outsider/anonymous denial afterward, same-organization reads and orphan-retention checks.

## O2: proposal until isolated reproduction

Potential cascade/RESTRICT interaction for deleting a workspace with legal entities and sites must be tested, not inferred from multiple FK paths. Test the actual source relationship definitions with synthetic data. Record success or a precise constraint failure. Do not change legal-entity/site deletion rules, introduce cascades or delete customer history to make the test pass. Any reproduction becomes a bounded follow-up with an explicit deletion/retention decision.

## Scope and freeze

Keep acceptance baseline `7dccd5452152f2495d10ad1437d5d03215166065` immutable. This supplemental source fix is a new candidate PR; it does not silently change the existing UAT checkout or its migration manifest. If integrated into the acceptance candidate, explicitly repin SHA and regenerate the manifest.

CI/isolated SQL are source evidence. Actual browser, JWT/RPC/Storage, real catalog grants, migration/restore and business UAT remain separate gates. Release HOLD; no merge, production access or cloud migration authorized.

## Isolated findings and closure

O1 was reproduced using the original SELECT policy prefix read directly from the historical migration, with synthetic table grants to test the policy rather than missing privileges. The incremental `202610310006_action_logs_read_boundary.sql` restricts SELECT to authenticated active members of non-null organizations. Synthetic tests verify anonymous/outsider/revoked denial, active same-tenant reads, unchanged grants and retained orphan logs readable by service role. Live grants, actual log content and cloud exposure remain unverified.

O2 is **NOT_REPRODUCED in the tested graph**: deleting a synthetic workspace with a legal entity, site and project succeeded under the original boundary definitions and again after migration 004; associated rows were removed according to their existing relationships. No deletion-rule fix is introduced. This scoped result does not cover all historical data graphs, concurrent requests or the application's authorized deletion workflow.

The policy test loads only the exact SELECT-policy prefix of the historical follow-up file; it does not execute the unrelated Storage/purge functions or claim the complete migration chain passed. See the new action-log test and its companion README for reproducible scope and commands.
