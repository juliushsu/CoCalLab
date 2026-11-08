# N4 lock-order source candidate

Application da5a0990c8ec82d2b55064dd7e009b771409fa73 adds only incremental 202611080001 after the ed6 N1/N3 candidate. Source47 migrations =44 schema/governance +3 historical fixture DML held. All47 blobs were compared against this exact Git tree. This is not cloud applied history or permission to alter an existing project.

The 16 Edge function sources, CLI2.122.1/Deno2.9.8 config and exact Auth/CORS/JWT proposal remain byte-identical to ed6; see ../ed6ca9bbfbc5/ for the existing full config and its parser receipt. Those proofs were actually run on ed6, not rerun or relabelled as da5 managed execution. No new function, credential, bucket, permission or UI is added by this fix.

Early project row locks in three existing functions remove the named native delete/MANUAL-create inversion while preserving actor checks and revoked-actor processing cleanup. Baseline ed6 40P01 and candidate da5 schedule evidence are separate. Other lock schedules and genuine service acceptance remain open; see docs/delivery/NATIVE_POSTGRES_CONCURRENCY_20261108.md.

Targetref remains null; RELEASE HOLD. New resources/fees/cloud schema/buckets/accounts/upload/backup/restore/deployment still need explicit environment-operation authorization. Existing projects must recalculate before new reports; old in-flight recalculations may fail. Never auto recalculate/re-sign/overwrite history.
