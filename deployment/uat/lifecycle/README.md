# Windows lifecycle scheduler proof — SYNTHETIC ONLY

This harness registers real one-time Windows Task Scheduler tasks. It deliberately has **no Supabase adapter, credentials, networking, real database restore, or cloud deletion**. The fixed product remains `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`.

Run from the repository root in the existing Owner Windows account using PowerShell 7, Node, and the built-in ScheduledTasks module. No new account, stored password, execution-policy bypass, system service, or machine-wide installation is required. The Codex sandbox identity cannot use this host's Task Scheduler; the actual-account invocation requires the normal tool approval boundary.

```powershell
pwsh -NoProfile -File deployment/uat/lifecycle/test-windows-scheduler.ps1 -Mode Install
```

Install creates a unique run below `../tooling/uat-lifecycle-20261109/` and ten tasks below `\CoCalLab-UAT-Lifecycle\<runId>\`. Five scenarios each get backup at +65 seconds and expire at +125 seconds. Do not overwrite an existing run. All fixtures contain explicit SYNTHETIC text. A successful expire changes only `synthetic-resource.json`; it deletes no bytes or cloud resources.

After those trigger times, inspect the exact returned run directory:

```powershell
pwsh -NoProfile -File deployment/uat/lifecycle/test-windows-scheduler.ps1 -Mode Inspect -RunDirectory '<EXACT_RETURNED_RUN_DIRECTORY>'
```

Expected results: happy 0/0, backup_failure 23/23, restore_failure 23/23, tamper_after_verification 0/23, target_mismatch 23/23. Exit 23 is an intentional guard refusal. Local `ALERT_REQUIRED.json` is **not a delivered human notification**.

Optional idempotency replay, only after the happy expiry succeeded:

```powershell
pwsh -NoProfile -File deployment/uat/lifecycle/test-windows-scheduler.ps1 -Mode ReplayHappy -RunDirectory '<EXACT_RETURNED_RUN_DIRECTORY>'
```

Inspect again after completion: happy must show `ALREADY_MARKED_ABSENT`, with `deleteTransitions=1`. Preserve registration, audit, manifests and inspection evidence. Disable only the ten exact tasks created by that run after collecting proof; do not disable the parent folder or unrelated jobs. The delivered 20261109-512e414f run has already been disabled; no further background run is promised.

This is a small, serial synthetic probe. It does not validate interrupted/rebooted execution, multi-run races, crash recovery, real DB/Storage consistency, genuine credentials, budget enforcement, or production backup/deletion. Interactive/Limited tasks require the Owner logged in and PC powered on. Task Scheduler metadata and engine audit timestamps differed in the observed run; neither a punctuality SLA nor 24x7 operation has been proven.

See [the execution plan](../../../docs/delivery/UAT_LIFECYCLE_EXECUTION_PLAN_20261109.md) and [actual evidence](../../../docs/delivery/evidence/uat-lifecycle-20261109/SCHEDULER_TEST_RECEIPT.json). No real paid project may rely on this test engine as its lifecycle controller.
