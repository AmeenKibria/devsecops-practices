# 0001 — Phase 1 baseline

Date: 2026-09-20
Repo: AmeenKibria/devsecops-practices (public)

## What exists

A minimal pipeline with no security controls at all:

1. checkout
2. docker login to ghcr.io
3. build image and push, tagged with the commit SHA

## Baseline measurements

- Push to image in registry: ~30 seconds (runs of 39s, 30s, 28s)
- Workflow steps: 3
- Manual steps outside the pipeline: none — but also nothing verified

## Known gaps, deliberately left open

- No secret scanning
- No SAST
- No dependency scanning (SCA)
- No container image scanning
- No SBOM
- No artifact signing or provenance
- Container runs as root
- No lockfile — dependencies unpinned
- `express` 4.16.4 and `lodash` 4.17.11 are deliberately outdated
- `/echo` reflects unescaped user input into an HTML response
- `/echo` logs the full request body

## Why this matters

Every control added from Phase 2 onward closes one of these gaps
deliberately, with a recorded decision about whether it blocks.

Phase 5 compares delivery time against the ~30s baseline above.
The argument I need to be able to make is that controls improved
security without materially slowing delivery.