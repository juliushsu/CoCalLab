# Fixed UAT package: fd7efcfc6450

Product fd7efcfc6450dbf10f54aa97b65fe48e431b277d = CTO-source-closed0405097 core + receipt-status presentation at report generation time. SQL/RPC/RLS/Edge/modules unchanged. Claude e4fd606 and the latest CTO ruling are received; do not restart that review.

RELEASE HOLD. Budget USD20 cumulative /14days OWNER_CONFIRMED; resource execution WAITING_UAT_ENVIRONMENT_AUTHORIZATION. Target=null; no cloud operations. See ../../authorization-status.json. The original note that fees were generically unauthorized is superseded by this budget/operation split.

49 migration source hashes are unchanged:46 schema proposal,3 historical fixture DML HOLD; never unfiltered db push. Existing projects must explicitly recalculate before new reports; old in-flight recalc may fail. Never auto recalc/reseal/mutate history. Receipt status shown in a report is the status at report-generation time.

Run node deployment/uat/prepare-fixed-package.mjs build, then verify, from repo root. Offline local artifacts only: fixed Git source, unconfigured genuine frontend build,16 static Edge bundles with13-function deploy proposal, schema/held files, proposed config and handover. No.env/credentials/data, no cloud CLI execution. Missing dependencies fail rather than install. Managed Edge/runtime/ESZIP and real UAT remain NOT_RUN.

See docs/delivery/UAT_FIXED_CANDIDATE_20261108.md, SOURCE_CLOSURE_20261108.md, UAT_REMAINING_ACCEPTANCE_20261108.md and UAT_AUTHORIZATION_RECORD_20261108.md. UPDATE-between-triggers and other concurrency remain in UAT. Old040 evidence and package settings remain historical, never silently relabelled.
