# 0001 — Phase 1 baseline

Date: 2026-09-20

Pipeline: checkout, docker login, build, push to ghcr.
No security controls of any kind.

- Push to image available: X minutes
- Workflow steps: 3
- Known gaps: no scanning, no SBOM, no signing, runs as root,
  no lockfile, unescaped user input in /echo

This is the measurement Phase 5 compares against.
