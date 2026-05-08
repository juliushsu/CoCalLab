# Known Limitations

Status: closed-beta governance.

## Boundary Limitations

- Current `organizations` table is semantically treated as workspace.
- Legal entities are not yet first-class production records.
- Sites/facilities/installations are not yet first-class production records.
- `projects.boundary_type` is a compatibility label, not a full boundary engine.
- Operational control, financial control, and equity share are documented semantics but not fully enforced by a boundary engine.

## Report Limitations

- Existing reports rely primarily on `report_generations.payload`.
- Legal entity, site, methodology, and template snapshots are proposed but not fully enforced for legacy rows.
- Historical reports must not be mutated to fill new snapshot fields unless a new version is generated.

## Duplicate Prevention Limitations

- `source_uid`, ownership allocation, and duplicate-source validation are proposal-level in this sprint.
- The system does not yet prevent two legal entities from entering the same real-world source.
- No cross-workspace duplicate matching exists.

## RLS Limitations

- Current RLS is based on `organization_members`.
- Entity-level and site-level membership are not production semantics yet.
- Workspace admin inheritance rules are proposed but not enforced across new tables until the RLS redesign phase.

## Seed Limitations

- `stg_core_closed_beta` is canonical for staging verification.
- Seed data is not customer data.
- Public-beta flows must not depend on staging seed assumptions.

## Explicitly Unsupported

- Public signup.
- Multi-tenant public rollout.
- Consultant marketplace.
- Destructive DB rewrite.
- Direct rename of `organizations`.
- Historical report deletion.
