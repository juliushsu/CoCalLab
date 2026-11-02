# CoCalLab — PC Agent Resource Discovery (2026-11-02)

Status: **PARTIALLY VERIFIED / NO DEPLOYMENT AUTHORIZATION**

## Verified GitHub
- Repository: `juliushsu/CoCalLab`
- Default branch: `main`
- Repository visibility: **PUBLIC**.
- Source folders: `backend/`, `frontend/readdy-app/`, `docs/`.
- Read `README.md`, `AI_COLLABORATION.md`, and `docs/PROJECT_OVERVIEW.md` first.
- Existing overview dated 2026-05-08; revalidate current code and configuration.

## Supabase — verified via connected account project listing (2026-11-02)
- **Candidate project display name (exact spelling):** `CaCalLab 架構指示稿 (via Readdy)`
- **Project ref:** `wynqnvidepzzcwutexvn`
- **Region:** `ap-northeast-1`
- **Reported project status:** `ACTIVE_HEALTHY`
- **Organization identifier:** `empvseawywarugdnyhzl`
- **Association confidence:** NAME MATCH ONLY. The live project is confirmed to exist, but **its binding to the GitHub code and intended Production/Staging role have NOT been verified**. Do not treat ACTIVE_HEALTHY as proof of functioning application or completed deployment.
- **Action:** inspect the repository's Supabase configuration, migrations, frontend environment variable *names only*, function contracts, and existing deployment evidence. Verify ownership and environment binding before any write or migration.
- **Security:** never commit passwords, access tokens, service-role keys, secret keys, .env values, or private customer data.

## Cloudflare — unverified
- **Cloudflare account/project name:** UNKNOWN.
- **Pages project:** NOT VERIFIED / MAY NOT EXIST.
- **Production domain, DNS, Worker, environment binding:** UNKNOWN.
- No Cloudflare account-management connector was available in this audit. Do not create a project or claim it is absent. Ask an authorized operator to inspect Cloudflare dashboard and provide non-secret account/project identifiers and deployment evidence.

## Runway / Railway / Readdy — do not conflate
- **Runway (AI media platform) project name:** UNKNOWN / NOT VERIFIED.
- **Railway (hosting platform) project name:** UNKNOWN / NOT VERIFIED.
- **Readdy:** confirmed as the frontend export provenance from repository README; source lives at `frontend/readdy-app/`. A Readdy app/project identifier has NOT been verified.
- Confirm which service the owner means by “runway” before configuring any integration or deployment.

## PC Agent instructions
1. Read this file and the three entrypoint documents above.
2. Produce a **read-only** evidence table: provider, project, project ID, environment, source evidence, confidence, owner confirmation required.
3. Inspect repo source/config for Supabase project ref and hosting integration; report any mismatch. Never assume the candidate Supabase project is production.
4. Audit real vs mock vs partial functionality before feature work.
5. Keep infrastructure creation, billable resources, migrations, secrets, remote writes, and production deployment **HOLD** until separately authorized.
6. Open a PR for verified corrections and record evidence. Never silently replace unknowns with guessed names.

## Handover gates
- GITHUB_SOURCE: VERIFIED
- SUPABASE_PROJECT_EXISTS: VERIFIED
- SUPABASE_CODE_BINDING: PENDING
- CLOUDFLARE_PROJECT: UNKNOWN
- RUNWAY_PROJECT: UNKNOWN
- RAILWAY_PROJECT: UNKNOWN
- READDY_FRONTEND_SOURCE: VERIFIED
- PRODUCTION_DEPLOYMENT: NOT VERIFIED / NOT AUTHORIZED
