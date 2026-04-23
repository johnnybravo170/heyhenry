# Backups — Status and Build Plan

<!-- STATUS: 🟡 CODE LANDED — waiting on Jonathan to provision R2 bucket + GH secrets + PITR. -->

> **Context.** `PHASE_1_PLAN.md §1D.1` called backup infrastructure
> "non-negotiable from day 1". It got deferred and never came back. This
> doc is the catch-up: what's actually protecting customer data today,
> what's missing, and what to build and when.

## Activation checklist (Jonathan)

Code-level plumbing is in. To go live, complete these in order:

1. **Enable Supabase PITR.** Dashboard → Database → Backups → PITR toggle
   (billing add-on, ~$100/mo). No code change.
2. **Create Cloudflare R2 bucket** `heyhenry-backups`. Generate an S3
   API token with object read/write scoped to that bucket.
3. **Add R2 lifecycle rules** on the bucket:
   - prefix `daily/`: expire after 30 days
   - prefix `weekly/`: expire after 84 days
   - prefix `monthly/`: expire after 365 days
   (Phase 1 only writes to `daily/`. Weekly/monthly promotion is Phase 2.)
4. **Add GitHub Actions secrets** (Repo → Settings → Secrets → Actions):
   `BACKUP_DATABASE_URL`, `BACKUP_ENCRYPTION_KEY` (generate with
   `openssl rand -base64 48` — store a copy in 1Password),
   `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`.
5. **Trigger `nightly-backup.yml` manually** via Actions → Run workflow
   to verify the first dump lands in R2.
6. **Trigger `restore-drill.yml` manually** to confirm the restore path
   works end to end before trusting the monthly cron.

## Current state (2026-04-21)

| Layer | Status | Notes |
|------|--------|-------|
| Supabase daily snapshots | ✅ Active | Pro tier default. 7-day retention. Physical backups. |
| Point-in-time recovery (PITR) | ❌ Not enabled | Requires add-on (~$100/mo). |
| Off-platform backup | ❌ None | Lives inside Supabase's AWS account. Same region. |
| Verified restore drill | ❌ Never tested | Untested backups ≈ no backups. |
| Encryption of off-platform copy | ❌ N/A | Moot without off-platform copy. |

**Realistic worst-case today:** a bad migration or admin error at 11 am
can only be recovered from the 03 am daily snapshot — up to 8 hours of
data lost. If Supabase's AWS presence has a catastrophic failure, we
lose everything.

## Target state (minimum viable)

1. **PITR enabled** on Supabase so any incident in the last 7 days is
   recoverable to the second.
2. **Nightly `pg_dump` to an external store** (Cloudflare R2 or AWS S3,
   separate account from Supabase), AES-256 encrypted at rest.
3. **Monthly restore drill** — spin up an empty Supabase project,
   restore the latest dump, verify a handful of rows match prod. One
   script, scheduled, alerts on failure.
4. **Photo storage mirror** — Supabase Storage `photos` bucket also
   mirrored nightly to the same external store (incremental, `aws s3 sync`
   equivalent).

## Build plan

### Phase 1 — Safety floor (target: same week we land our first paying customer, or sooner)

1. **Enable Supabase PITR.** ❌ Pending (dashboard + billing — see
   activation checklist).
2. **Nightly `pg_dump` workflow** — ✅ `.github/workflows/nightly-backup.yml`.
   Runs 03:00 UTC. Installs Postgres 17 client, dumps with
   `--format=custom --no-owner --no-acl --clean --if-exists`, encrypts
   with `openssl aes-256-cbc` (pbkdf2, 100k iter), uploads to R2 under
   `daily/`. Failure alert via Resend → `OPS_ALERTS_TO_EMAIL`.
3. **Retention.** ❌ Pending — configure R2 lifecycle rules (see
   activation checklist). Phase 1 ships with `daily/` only; weekly and
   monthly promotion is Phase 2.
4. **Restore drill** — ✅ `scripts/restore-test.ts` +
   `.github/workflows/restore-drill.yml`. Monthly cron (1st of month,
   05:00 UTC). Spins up a Postgres 17 service container, downloads the
   newest R2 object, decrypts, `pg_restore`s, and asserts `tenants`,
   `customers`, `projects`, `jobs` exist (with `tenants` non-empty).

### Phase 2 — Full DR (target: before 10th paying tenant)

5. **Photo storage mirror** — nightly `rclone sync` of the `photos`
   bucket to the same external store. Respects Supabase RLS path
   convention so restores preserve tenant isolation.
6. **Cross-region replica** — Supabase read replica in a second region
   (us-west-2 or eu-west-1). Failover runbook documented.
7. **Secrets rotation runbook** — if a backup key leaks, how to rotate
   without invalidating the last 30 days of encrypted dumps.
8. **Quarterly DR drill** — actually cut over to the restored copy,
   measure RTO (recovery time) and RPO (data loss window), document.

## Trigger for starting

Earliest of:
- First paying customer signs up
- 2026-05-31
- A security / compliance conversation with any prospect
- Any data incident (however small)

The moment any of these hits, Phase 1 of this plan is the next thing
that ships, ahead of feature work.

## Where this lives elsewhere

- `PHASE_1_PLAN.md` header banner references this doc.
- Seeded as an idea in `ops.ideas` with priority-high tag so it
  surfaces in the ops UI.
- Memory note at `~/.claude/projects/-Users-henry/memory/project_heyhenry_backups.md`
  so future Claude sessions see it immediately.
