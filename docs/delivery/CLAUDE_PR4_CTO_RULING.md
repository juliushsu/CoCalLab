# PR #4 re-review: CTO ruling

2026-10-31. Reviewed baseline: `8b8b444b3313bc169c7c8fc479f03d8ffffb678c`.

Intake: owner reports Claude's F1–F6 re-review as resolved at source level, with no test rerun or independent CI validation. The original Windows-local report is not accessible here. Accept F1–F6 as **SOURCE_CLOSED**, combining that reported review with the previously recorded Codex evidence. This is not live remediation or production acceptance. Release remains **HOLD**.

## N1 — accept finding; fix current-session logout

The captured old JWT was submitted with global scope. A delayed request can affect sessions created while that request was pending. Replace that remote request with explicit `local` scope, targeting the captured session; the normal logout action does not revoke other sessions. Preserve the persistent local fence and the distinction between local clearing and remote revocation. Update UI wording accordingly.

Authority: [Supabase sign-out scopes](https://supabase.com/docs/guides/auth/signout) defines local as the current session and global as all sessions. Installed SDK request construction is checked with actual AuthClient and offline fetch. A deferred-request regression verifies scope, captured old token and preservation of a newly persisted login after completion. This verifies SDK/client behavior; real remote-service ordering remains untested.

## N2 — ACCEPTED_WITH_BOUNDARIES

Accept failure to log in when durable browser auth storage is unavailable. Do not silently substitute in-memory storage and then claim persistent logout protection. Retain the user-visible storage error and the existing failure-path tests. Browser/storage compatibility must be checked in representative UAT before launch. A future ephemeral-session mode requires its own explicit behavior and tests; it is not part of this correction.

## Remaining gates and next work

- Source/unit/SDK regression and CI for the N1 correction; this is a small follow-up to PR #4, not a reopening of all six findings.
- No repeat full H0 or open-ended red-team rounds. Escalate only concrete new findings or new security-sensitive behavior.
- Before database rollout: real version/ACL preflight, existing inconsistent rows, lock budget and controlled constraint validation. Do not repair historical data automatically.
- Before launch: real browser sign-in/logout/reload, actual JWT/RPC/Storage tenant denial, migration/upgrade/recovery and representative business acceptance. Then provide immutable version, rollback and costs for owner release approval.

No merge, cloud mutation, paid service connection or deployment is authorized by this source-level ruling. Other local implementation and isolated verification remain authorized.
