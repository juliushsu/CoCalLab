# Tester Onboarding Guide

Status: closed-beta only.

## Purpose

Closed-beta testers validate the canonical SaaS core, not public signup or marketplace workflows. The test goal is world model consistency, boundary governance clarity, migration safety, report immutability, and seed reproducibility.

## Tester Setup

1. Use the staging environment only.
2. Use accounts explicitly provisioned by the team.
3. Confirm membership through the canonical staging workspace.
4. Do not create production customer data.
5. Do not treat `organization` UI labels as final product vocabulary.

## What Testers Should Validate

- Workspace/member/subscription access.
- Project creation and project list behavior.
- Document upload, draft review, activity creation, recalculation.
- Analytics by scope/category/month/hotspot.
- Report generation history and preview.
- Adjustment scenario visibility.
- Readonly subscription behavior.
- Closed-beta known limitations.

## Boundary Vocabulary For Testers

During this phase:

- `organization` in the UI means workspace/tenant.
- Legal entity and site governance are architecture proposals unless enabled in staging.
- Reports are generated for project-level inventory under one workspace.
- Multi-entity consolidation is not a public or production flow.

## Feedback Format

Tester feedback should include:

- environment
- user account
- workspace/organization id
- project id
- report generation id when relevant
- exact page or endpoint
- expected result
- actual result
- screenshots/log snippets if available

## Not In Scope

- Public signup.
- Public multi-tenant rollout.
- Consultant marketplace.
- Production migrations.
- Deleting or rewriting historical report data.
