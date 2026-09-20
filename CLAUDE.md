# CLAUDE.md

## What this is
A learning project. I am building a DevSecOps process end to end
to understand it, not to ship it. The plan is in docs/devsecops-model.md.

## How to work with me
- Explain before implementing. When I ask for a control, first tell me
  what it catches, what it misses, and the trade-off. Then wait.
- One control per session. Do not add tools I did not ask for.
- I make the decisions about what blocks and at what severity.
  Offer options, do not choose for me.
- After each control is working, remind me to write the ADR.

## Rules
- Never commit real credentials. Test secrets must be obviously fake.
- Every workflow step gets a comment saying why it is there.
- Infrastructure changes come from Terraform, never the console.