# 0002 — Phase 2, control 1: secret scanning

Date: 2026-09-20
Repo: AmeenKibria/devsecops-practices (public)
Supersedes nothing. Builds on 0001.

## What was added

TruffleHog secret scanning in `.github/workflows/build.yml`, as its own
`secret-scan` job that `build` depends on. Nothing is built, tagged or
pushed until the gate passes.

## Decisions

**1. Cleaned `node_modules` out of git history first.**
`app/node_modules/**` was committed in the first commit and ignored in a
later one — removed from the working tree, still fully present in history.
Rewrote history with `git filter-repo --path app/node_modules --invert-paths`.
History went from 1,445 objects to 32, and `.git` from 15M to 8.4M.
Done before adding the scanner so it scans my own code, not 1,400 files of
vendored third-party code that would be a false-positive source.

**2. TruffleHog rather than gitleaks.**
Both were installed and tested locally. They detect the same way — regex
patterns per provider. TruffleHog adds *verification*: it calls the
provider's API with a candidate credential to check whether it is live.
That is the reason for the choice. gitleaks remains a reasonable fallback.

**3. Verified findings block. Unverified and unknown are report-only.**

| Result type | Meaning | Action |
| --- | --- | --- |
| `verified` | Confirmed live by calling the provider | **Fails the build** |
| `unverified` | Secret-shaped, not confirmed live | Logged, build continues |
| `unknown` | Verification errored (network, provider down) | Logged, build continues |

A verified finding is a live credential in the repository. There is no
legitimate case for that, and the false-positive rate is near zero, so
blocking is safe. Blocking on `unverified` would fail builds on test
fixtures and already-rotated keys — which is how a gate gets switched off
by an irritated team under deadline. Revisit once the false-positive rate
over a few weeks is actually known.

**4. The per-push gate scans the commit range of the push, not full history.**
Full-history scanning belongs in a separate scheduled job, so the gate on
the fast path stays fast. This matches normal practice: the pipeline gate
is incremental, the safety net is scheduled. The scheduled job is not built
yet — see open items.

**5. Both the action and the image it pulls are pinned.**
The action is pinned to commit SHA `f714bf454f350590f4a24c3ddb1aef02c35bf5b6`
(release v3.97.5) rather than `@main`. A third-party action at `@main` runs
whatever its maintainers pushed most recently, inside this pipeline. The
`version: "3.97.5"` input pins the container image the action pulls —
pinning the action alone would leave the image floating on `:latest`.

## Known limitations, accepted deliberately

- **The blocking gate cannot be tested.** Producing a `verified` finding
  requires a real, live credential. A fake key is unverifiable by definition.
  So the blocking path has never been observed to fire. This is the direct
  cost of decision 3, and it is the weakest point of this control.
- **Verification depends on the runner having outbound internet.** With no
  egress, every result becomes `unknown` and the gate never fires — it would
  report green while scanning nothing meaningful.
- **Verification uses the leaked credential.** The check appears in the
  provider's audit log (an AWS `GetCallerIdentity` from a GitHub runner IP).
  Harmless, but it surprises people.
- **TruffleHog's AWS detector needs the key pair.** A lone `AKIA...` access
  key ID is not reported. gitleaks flagged it on its own. Fewer false
  positives, slightly less coverage.
- **No scanner catches a human-chosen password.** `Crusher2026!` has no
  recognisable shape. Detection is a backstop; the real control is not
  having secrets in code — vaults and short-lived credentials. Phase 3's
  keyless signing via OIDC is the first step toward that.
- **The CI gate cannot prevent, only detect.** Closed separately by enabling
  GitHub push protection - see below.

## Addition: GitHub push protection

Enabled the same day, alongside the CI gate. Settings -> Advanced Security ->
Secret Protection, then Push protection.

**Why, on top of TruffleHog.** The CI gate fires only AFTER a push. On a
public repository a credential is exposed the moment it lands, so a red build
is a notification, not a defence. Push protection rejects the `git push`
itself, server side, so the secret never reaches GitHub.

**Verified by testing, which the CI gate could not be.** Push protection
matches on shape, not liveness, so a fake key is enough to test it. Committed
a randomly generated AWS key pair on a throwaway branch and pushed:

    remote: error: GH013: Repository rule violations found
    remote:   - Push cannot contain secrets
    remote:     -- Amazon AWS Access Key ID
    remote:     -- Amazon AWS Secret Access Key
    ! [remote rejected] test/push-protection (push declined)

Rejected. Nothing reached GitHub, so cleanup was deleting a local branch -
compare with the history rewrite needed to remove node_modules earlier the
same day. Prevention is cheap, cleanup is expensive.

Note: GitHub flagged the access key ID and the secret access key as two
separate findings. TruffleHog reports nothing unless it sees the pair. Neither
is wrong; they are different thresholds, which is the argument for layering
rather than picking one scanner.

**What it does not cover.**

- Only GitHub's registered partner patterns. Narrower than TruffleHog.
  Custom or internal secret formats need the paid tier.
- Human-chosen passwords - the universal blind spot.
- Only pushes to GitHub. The same commit pushed to another remote is unaffected.
- **It is bypassable.** The rejection includes an unblock URL. Anyone with
  write access can declare it a false positive and push anyway. It raises an
  alert rather than stopping them - a speed bump with an audit trail, not a
  wall. Restricting who may bypass is a paid feature and is not in place.

**Also on, unconditionally:** because the repository is public, GitHub always
forwards detected secrets to the issuing provider, who can revoke them. That
is the only part of this system that fixes a leak rather than reporting it,
and it is not something that had to be turned on.

## Measurements

- Before this control (builds #1-#7): 28, 30, 32, 32, 36, 39, 39 seconds.
  Mean ~34s. ADR 0001 quoted ~30s from the first three runs.
- After this control (builds #8, #9): 47 and 50 seconds. Mean ~48s.
- Cost of the control: roughly **14 seconds**, about 43% on a ~34s pipeline.

Build #8 was suspected of being inflated by a cold TruffleHog image pull.
Build #9 was slower, not faster, so that is ruled out: the image is pulled
fresh on every run and there is no warm-up benefit to wait for. The cost is
real and steady.

Still only two samples. Worth re-checking over more runs before this number
is quoted as the Phase 5 comparison. If the 14s becomes a problem, caching
the TruffleHog image is the obvious lever, not weakening the gate.

## Open items

- Scheduled full-history scan (weekly), separate from the per-push gate
- Decide a suppression policy. TruffleHog ignores lines marked
  `trufflehog:ignore`, which has no owner, reason or expiry — that
  contradicts the time-boxed exception model in the governance layer.
  Phase 4 should reconcile these.
- Dependabot alerts were switched on the same day, without a decision record.
  It is report-only so nothing blocks, but it is an undocumented control that
  will start producing findings against the deliberately outdated `express`
  and `lodash`. Fold it into the SCA session and write it up properly.
