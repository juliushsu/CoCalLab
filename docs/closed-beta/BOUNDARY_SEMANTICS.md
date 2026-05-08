# Boundary Semantics

Status: closed-beta reference.

## Current Closed-Beta Meaning

| UI/API term | Closed-beta meaning |
| --- | --- |
| organization | workspace / SaaS tenant |
| organization member | workspace member |
| organization subscription | workspace subscription |
| project | reporting cycle and report generation unit |
| boundary type | compatibility label |
| report generation | immutable report payload snapshot |

## Future Canonical Meaning

| Canonical term | Meaning |
| --- | --- |
| workspace | SaaS tenant, billing, members, subscription |
| legal entity |法人, tax id, reporting subject |
| site | facility, installation, CBAM-ready location |
| project | inventory boundary, reporting cycle, report generation unit |
| report boundary | operational control, financial control, or equity share inclusion model |

## Boundary Methods

### Operational Control

Include emissions from entities, sites, and sources where the reporting subject has operational authority to introduce and implement operating policies.

### Financial Control

Include emissions from entities, sites, and sources where the reporting subject has financial authority and receives economic benefits or bears financial risks.

### Equity Share

Include emissions by ownership ratio or equity share. Allocation must be explicit and report-snapshotted.

## Tester Interpretation Rule

When a tester sees `organization`, read it as workspace. Do not infer that it is the final legal reporting subject model.
