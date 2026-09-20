# DevSecOps process model — reference and home lab build plan

## The model at a glance

A DevSecOps process is four layers. Most organisations build only the second one, then wonder why security still arrives late and gets argued about.

| Layer | What it answers | Who owns it |
| --- | --- | --- |
| Governance | Who is accountable, what must be true to release, who grants exceptions | Platform / security lead |
| Pipeline controls | Which checks run automatically, and which ones block | Platform team, in shared templates |
| Practice | How people work: threat modelling, review, triage | Development teams, guided by standards |
| Feedback and metrics | Is it working, and is it slowing delivery down | Lead, reported to management |

The pipeline is the visible layer. It is also the least valuable one on its own: scanners without an owner, an SLA and a decision on what blocks produce a dashboard nobody acts on, and a false sense of compliance.

**The loop matters more than the stages.** A vulnerability found in production must change something upstream — a dependency policy, a threat model, a pipeline rule, a base image. If findings do not flow back into planning, you are operating a scanner, not a process.

The four lifecycle stages used throughout this document:

- **Plan** — design decisions, threat modelling, what the system is allowed to do
- **Build** — source code, dependencies, container images, infrastructure code
- **Release** — artifact provenance, SBOM, signing, promotion between environments
- **Operate** — runtime posture, vulnerability handling, patching, incident response

## Layer 1 — Governance

This is the layer almost nobody writes down, and the one that decides whether the other three survive contact with a delivery deadline.

### Ownership

Every product or service needs a named security owner on the development side — not the security team, not the platform team. The platform provides the rails; the team owns what runs on them. Write it in a register: service name, team, owner, criticality tier.

Tiering matters because uniform rules fail. A public-facing API and an internal reporting job should not carry the same controls. Three tiers is usually enough: critical (internet-facing or handling regulated data), standard, low.

### The release standard

A single page answering: what must be true before this goes to production? Example baseline:

- No critical or high vulnerabilities in dependencies without an accepted exception
- No secrets detected in the repository
- SAST clean at the configured severity threshold, or findings triaged
- SBOM generated and stored for the artifact
- Artifact built by the pipeline and signed — no local builds promoted
- Infrastructure changes applied from code, not from a console

The standard has to be short enough that a developer can hold it in their head. If it runs to five pages, it will be ignored.

### Exceptions

Exceptions are not a failure of the process — they are the process. A control with no exception path gets bypassed silently, which is worse.

Rules worth setting: exceptions are time-boxed (30 or 90 days), they name a granting authority, they carry a reason and a remediation plan, and they expire automatically rather than needing revocation. Keep them in one place and review the list monthly. A growing exception list is itself a metric.

### Evidence

Decide up front what gets retained and for how long: scan results per build, SBOM per release, approval and exception records, and the audit trail of who deployed what, when.

This is dull until an auditor or a regulator asks, at which point it is the whole conversation. Under the EU Cyber Resilience Act it becomes a conformity requirement rather than good hygiene.

### Decision forums

Name where technical decisions get made and recorded. An architecture decision record per significant choice, reviewed by peers, is enough — the point is that the reasoning survives the person who made it.

## Layer 2 — Pipeline controls

The automated checks. Two principles before the list: controls live in **shared pipeline templates**, not copy-pasted into each repository, and every control has an explicit answer to *does this block, or just report?*

### Build stage

**Secret scanning.** Detects credentials committed to the repository. Should block, always, in every tier — there is no legitimate reason to commit a key. Run it on history as well as on new commits. Tools: gitleaks, trufflehog, GitHub secret scanning.

**SAST — static application security testing.** Analyses source code without running it: injection flaws, unsafe deserialisation, path traversal. Start as report-only, then block on high severity once the false positive rate is tuned. Tools: Semgrep, CodeQL, SonarQube.

**SCA — software composition analysis.** Scans third-party dependencies against known vulnerability databases, and flags licence problems. This catches more real risk than SAST, because most incidents arrive through a dependency nobody updated. Tools: Trivy, Grype, Dependabot, Renovate.

**IaC scanning.** Checks Terraform, Bicep, Kubernetes manifests and Helm charts against security rules: public storage buckets, permissive security groups, missing encryption, privileged containers. Tools: Checkov, tfsec, Trivy config, KICS. Policy-as-code with OPA/Rego or Conftest for organisation-specific rules.

**Container image scanning.** Scans the built image for OS package and library vulnerabilities. Pair it with a curated base image set — most image findings come from the base, so controlling base images fixes them at the source. Tools: Trivy, Grype.

### Release stage

**SBOM generation.** A machine-readable inventory of everything in the artifact, in SPDX or CycloneDX format. Generate it at build time, attach it to the artifact, and store it. When the next widely-exploited library vulnerability lands, this turns a two-week investigation into a query. Tools: Syft, cdxgen.

**Artifact signing and provenance.** Cryptographically sign the artifact and record how it was built — which commit, which pipeline, which inputs. This is what stops an unreviewed image reaching production. Tools: cosign, Sigstore, in-toto attestations, SLSA provenance.

**Promotion gates.** The point where the release standard is enforced. The gate checks the artifact and its attestations, not the source — so what gets deployed is provably what was tested.

### Operate stage

**Continuous re-scanning.** Dependencies that were clean at build time will not stay clean. Re-scan deployed artifacts against updated vulnerability feeds, and alert on the delta.

**Runtime posture.** Kubernetes admission control enforcing the same policies the pipeline checked — Gatekeeper or Kyverno. Drift detection for infrastructure. Secrets served from a vault rather than environment variables.

### On what should block

A reasonable starting position: secrets block everywhere. Critical dependency vulnerabilities block for critical-tier services and warn elsewhere. SAST and IaC findings warn for the first quarter, then block at high severity.

Turning everything to blocking on day one is the fastest way to have the whole thing disabled by an irritated team under deadline.

## Layer 3 — Practice

How people work. Tooling cannot substitute for this layer, and it is where most of the actual risk reduction happens.

### Threat modelling

A structured conversation at design time: what are we building, what can go wrong, what are we doing about it, did we do a good enough job. STRIDE is the common vocabulary — spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.

Keep it proportionate. A one-hour whiteboard session per significant feature, with the output recorded as a short list of risks and mitigations, beats a formal methodology nobody has time for. Trigger it on: a new service, a new external interface, a change to authentication or authorisation, or a new data classification.

### Secure coding standards

Short, language-specific, and enforced by the linter wherever possible. The written standard should cover only what tooling cannot check: input validation expectations, how errors are handled and logged, what must never be logged, how secrets are obtained at runtime.

Anything a linter can enforce should be a linter rule rather than a document.

### Code review

Define what a reviewer is actually looking for on the security side: changes to authentication, authorisation or session handling; new external inputs; new dependencies; anything touching secrets or cryptography. A checklist of five items gets used; one of thirty does not.

Require review for those categories specifically, rather than blanket two-approver rules that get rubber-stamped.

### Vulnerability triage and SLA

The most commonly missing piece. Scanners generate findings; without a triage path and a clock, those findings accumulate and the dashboard becomes noise.

Define: who triages, how fast, and what the remediation windows are. A workable default:

| Severity | Triage within | Fix within |
| --- | --- | --- |
| Critical | 24 hours | 7 days |
| High | 3 days | 30 days |
| Medium | 7 days | 90 days |
| Low | Next planning cycle | Best effort |

Triage outcomes should be limited to three: fix, accept as an exception with an expiry, or reject as a false positive with a suppression rule. Anything else means the finding stays open forever.

### Dependency hygiene

Automated update pull requests (Renovate or Dependabot), a policy on how far behind a dependency may fall, and a curated set of approved base images. Most dependency risk is solved by updating regularly rather than by scanning harder.

### AI-assisted development

Newly relevant, and worth treating as a practice question rather than a tooling one:

- What code and data may be sent to a model, and which models are approved
- Whether generated code is reviewed to the same standard as written code — it should be
- Whether AI agents get their own identities with scoped, short-lived credentials — they should
- How intellectual property and licence exposure from generated code is handled

The underlying problem is not new. An agent is a non-human identity acting on your systems, and the answer is the same as for CI: named identity, least privilege, short-lived credentials, full audit trail.

## Layer 4 — Feedback and metrics

Two jobs: prove the process improves security, and prove it does not slow delivery down. You need both, because the first objection to any DevSecOps programme is that it will add friction.

### Delivery metrics — the DORA four

| Metric | What it measures |
| --- | --- |
| Deployment frequency | How often you ship to production |
| Lead time for changes | Commit to running in production |
| Change failure rate | Share of deployments causing a degradation |
| Time to restore service | How long recovery takes |

Baseline these **before** adding controls. If they hold steady or improve afterwards, the friction argument is closed with data rather than assertion.

A fifth is increasingly added: reliability, meaning performance against the service's own availability target.

### Security metrics

- **Mean time to remediate**, split by severity — the single most useful number
- **Open findings by age** — is the backlog growing or shrinking
- **SLA compliance rate** — share of findings fixed inside the window
- **Exception count and age** — a growing, ageing exception list means the standard is unrealistic
- **Coverage** — share of repositories on the shared pipeline template, share of services with an SBOM

Coverage is the one to watch early. A perfect pipeline used by three repositories out of forty is not a process.

### The feedback loop

Mechanisms that force findings back upstream:

- **Post-incident review** with an action that changes a control, a policy or a default — not just a fix to the immediate bug
- **Base image and template updates** pushed centrally, so one fix propagates to every consumer
- **New detection rules** written from real findings, so the same class of issue is caught earlier next time
- **Threat model revision** when an incident shows the model missed something

### Reporting rhythm

Monthly is usually right: coverage, SLA compliance, exception list, DORA trend. One page. The purpose is to make the state of things visible to people who fund the work, and to surface the teams that need help rather than the teams that need blaming.

## Home lab build plan

The goal is not to install every tool. It is to end with **one demonstrable pipeline** where you can point at each layer and say what it does, why it is there, and what you decided to make blocking.

All tooling below is free or has a usable free tier.

### What to build it on

A deliberately small application — a containerised API with a database and a few deliberately outdated dependencies. Deliberate vulnerabilities are useful here: you want findings to triage.

| Component | Suggested choice | Why |
| --- | --- | --- |
| SCM and CI | GitHub + Actions | Matches what Metso uses; free for public repos |
| Registry | GitHub Container Registry | Integrated, no extra setup |
| Runtime | k3s or kind on a local VM | Lightweight Kubernetes |
| Cloud target | A small AWS or GCP project | Matches what you already run |

### Phase 1 — Baseline the pipeline (weekend one)

Build and deploy with no security controls at all. Commit, build image, push, deploy. Record your DORA baseline now, before anything is added — this is the measurement you will use later to show controls did not slow things down.

### Phase 2 — Build-stage controls (weekend two)

Add, in this order, all as report-only:

- **gitleaks** for secret scanning — then switch this one to blocking immediately, since it should never fire legitimately
- **Semgrep** for SAST
- **Trivy** in filesystem mode for SCA
- **Checkov** or **Trivy config** for the Terraform
- **Trivy** image scan on the built container

The exercise is not installing them. It is deciding, for each, what severity should block and writing that decision down. Put it in the pipeline template as a comment so the reasoning travels with the config.

### Phase 3 — Release-stage controls (weekend three)

- **Syft** generating a CycloneDX SBOM at build time
- **cosign** signing the image, keyless via GitHub OIDC — this also demonstrates workload identity with no long-lived keys
- An attestation attaching the SBOM to the image
- A deploy step that **verifies the signature** before deploying, and fails closed

This phase produces your strongest interview story: an artifact that cannot reach the cluster unless it was built by the pipeline.

### Phase 4 — Governance as code (weekend four)

- A one-page release standard in the repository, in markdown
- **Conftest** or **OPA/Rego** policies encoding one or two rules from that standard
- **Kyverno** or **Gatekeeper** on the cluster, rejecting unsigned images and privileged pods
- An exceptions file with expiry dates, and a pipeline step that fails when an exception has expired

The expired-exception check is a small thing that demonstrates you understand governance as a running system rather than a document.

### Phase 5 — Feedback (weekend five)

- **DefectDojo** in a container to aggregate findings from all scanners into one place with triage state
- A scheduled workflow re-scanning the deployed image against updated feeds
- A simple metrics script: open findings by age and severity, exception count, SLA compliance
- Compare DORA numbers against the Phase 1 baseline

### Phase 6 — AI guardrails (optional, high value)

Given the Metso role explicitly covers this:

- A written policy on which models may be used and what may be sent to them
- A GitHub Actions workflow where an AI review step runs with a scoped token and its output is treated as advisory, never auto-merged
- Repository conventions documenting what the assistant may and may not touch
- Demonstrate an agent identity with a short-lived credential rather than a stored key

### What to produce at the end

A README explaining the four layers as implemented, a diagram, the release standard, and the decision log of what blocks and why. That artifact is worth more in an interview than any certification — it is evidence you have designed the process, not just used the tools.

## Reference frameworks

You do not need all of these. Pick one maturity model, one control framework, and know which regulation applies.

### Maturity models — where are we now

**OWASP DSOMM (DevSecOps Maturity Model).** The most directly practical for this work. Four maturity levels across build, deployment, culture, implementation and information gathering. Use it to produce an honest current-state assessment and a prioritised next step. Free, and has a browsable matrix.

**OWASP SAMM (Software Assurance Maturity Model).** Broader and more business-oriented — governance, design, implementation, verification, operations. Better for the governance layer and for conversations with management. Heavier than DSOMM.

### Control frameworks — what good looks like

**NIST SSDF (SP 800-218), Secure Software Development Framework.** The reference set of secure development practices, organised as prepare the organisation, protect the software, produce well-secured software, respond to vulnerabilities. This is the one regulators and customers map onto, so knowing it gives you a shared vocabulary.

**SLSA (Supply-chain Levels for Software Artifacts).** Specifically about build integrity and provenance. Levels from "scripted build" up to "hermetic, reproducible, two-party reviewed". Directly relevant to the signing and attestation work in Phase 3.

**CIS Benchmarks.** Configuration hardening baselines for specific technologies — Kubernetes, cloud platforms, operating systems. Narrower than the above, but concrete and testable.

### Sector and regulation

**EU Cyber Resilience Act (CRA).** Applies to any product with digital elements placed on the EU market. Entered into force December 2024. Vulnerability and incident reporting obligations applied from 11 September 2026; the remaining obligations — secure-by-design requirements, conformity assessment, technical documentation, CE marking, SBOM generation, vulnerability handling, and security updates across the support period — apply from 11 December 2027. Penalties reach €15 million or 2.5% of worldwide turnover.

For a manufacturer of connected industrial equipment, this converts much of the model above from best practice into a conformity obligation. SBOM generation, vulnerability handling with defined timelines, and a retained audit trail become evidence for CE marking.

**IEC 62443-4-1.** The secure product development lifecycle standard for industrial automation and control systems. The sector-specific companion to the CRA, and the one industrial customers ask about in tenders.

**ISO 27001 and SOC 2.** Organisational rather than product-level. Relevant because they drive evidence and audit requirements that the pipeline has to satisfy.

### Suggested reading order

1. OWASP DSOMM — browse the matrix, place yourself honestly on it
2. NIST SSDF — read the practice list, map it to your pipeline
3. SLSA levels — decide which level your build should reach
4. CRA articles on vulnerability handling and technical documentation — understand the obligation before designing for it
