# Multi-AI Canonical Rules V1

Date: 2026-05-30
Status: canonical alignment rules
Scope: documentation alignment only; no feature, schema, or migration change

## Purpose

This document defines the operating rules for every AI or design tool working on CoCalLab, including Readdy, ChatGPT, Codex, and future AI agents.

The goal is simple:

> There must be one source of truth for the product world model.

That source is the GitHub repository.

## Canonical Source Rule

| Source | Canonical Status | Rule |
|---|---|---|
| GitHub repository `juliushsu/CoCalLab` | Canonical | Single Source of Truth after commit and push |
| Readdy Sandbox | Not canonical | Design/source exploration only; must align to GitHub docs before implementation |
| Codex local files | Not canonical until pushed | Draft workspace only; not authoritative until committed and pushed to GitHub |
| ChatGPT conversation memory | Not canonical | Useful for reasoning, never authoritative over GitHub |
| ZIP exports | Not canonical | Patch source only; never wholesale replacement |
| Screenshots/mockups | Not canonical | UX reference only; cannot define entity model, DTO, or route ownership |

## Single Source Of Truth

The GitHub repo is the only canonical source for:

- Product world model.
- Entity vocabulary.
- Navigation ontology.
- Route ownership.
- DTO expectations.
- Backend/schema reality.
- Closed beta boundaries.
- Product narrative.
- Value moments.
- Readdy implementation constraints.

If an AI output conflicts with GitHub docs, GitHub wins.

If a Readdy screen conflicts with GitHub docs, GitHub wins.

If a local Codex draft conflicts with GitHub docs, GitHub wins until the draft is reviewed, committed, and pushed.

## Commit Rule

Important governance and alignment documents must be committed to GitHub before they are treated as canonical.

This includes:

- Boundary model.
- Navigation ontology.
- Role governance.
- Closed beta rules.
- Product narrative.
- Value moment definitions.
- Readdy alignment constraints.
- Canonical entity vocabulary.

Local docs are drafts. Pushed GitHub docs are canonical.

## Readdy Implementation Rule

Before Readdy creates or modifies a screen, it should read the relevant GitHub docs.

Minimum source set:

1. `docs/canonical/PROJECT_WORLD_MODEL_V1.md`
2. `docs/canonical/READDY_ALIGNMENT_PACK_V1.md`
3. `docs/canonical/PRODUCT_NARRATIVE_CANONICAL_V1.md`
4. `docs/canonical/VALUE_MOMENT_CANONICAL_V1.md`
5. Related architecture or closed-beta docs when route behavior is affected.

Readdy may improve value visibility, copy, journey clarity, trust signals, empty states, and feedback entry points.

Readdy may not independently define:

- New entity model.
- New DTO.
- New schema expectation.
- New governance engine.
- New route ownership.
- CBAM workflow.
- Product CFP workflow.
- Formal compliance validation behavior.

## AI Tool Responsibilities

### Readdy

Readdy is a UX/design implementation source, not the source of product truth.

Readdy should optimize:

- Value visibility.
- User journey flow.
- Success states.
- Trust signals.
- Feedback entry points.
- Copy that matches canonical scope.

Readdy must not invent domain objects or backend capability.

### ChatGPT

ChatGPT may reason, summarize, plan, and critique.

ChatGPT must not treat chat history as canonical if it conflicts with GitHub.

ChatGPT should cite or align to GitHub docs when making product or architecture claims.

### Codex

Codex may edit files and implement changes.

Codex local files are drafts until committed and pushed.

Codex must preserve canonical terminology, route constraints, DTO contracts, and closed-beta boundaries.

### Future AI Agents

Any future AI agent must:

- Read GitHub canonical docs first.
- Avoid inventing domain models.
- Avoid treating UI mockups as backend reality.
- Explicitly label assumptions.
- Seek canonical approval for model/schema/route changes.

## Canonical Update Rule

When the product world model changes:

1. Update canonical docs first.
2. Commit and push to GitHub.
3. Align implementation branches.
4. Align Readdy screens.
5. Align downstream AI instructions.

Do not update Readdy first and ask backend/docs to catch up later.

## Conflict Resolution

When sources disagree:

| Conflict | Resolution |
|---|---|
| Readdy vs GitHub docs | GitHub docs win |
| Local Codex draft vs GitHub docs | GitHub docs win until push |
| ChatGPT answer vs GitHub docs | GitHub docs win |
| ZIP export vs canonical repo | Canonical repo wins |
| UI copy vs schema/backend reality | Backend reality and canonical docs win |
| Product ambition vs closed-beta reality | Closed-beta reality wins for beta surfaces |

## Forbidden Alignment Anti-Patterns

Do not:

- Treat Readdy sandbox as canonical.
- Treat a ZIP as a replacement for the repo.
- Let UI create new ontology.
- Let product narrative imply unsupported compliance.
- Let CBAM/Product CFP language appear as current capability.
- Merge mock-heavy screens as production-ready.
- Use workspace, legal entity, and site interchangeably.
- Move platform governance into tenant workflow navigation.

## Final Rule

Every AI working on CoCalLab should follow this hierarchy:

1. GitHub canonical docs.
2. GitHub backend/schema/contracts.
3. GitHub frontend implementation.
4. Local drafts.
5. Readdy sandbox.
6. Conversation memory.

If there is uncertainty, stop and align to GitHub before implementation.
