# Realtime Interview Agent Guide

## Subagent delegation

- The primary agent owns requirements, cross-cutting decisions and final verification.
- Use `explorer` for read-heavy code tracing, `tester` for reproduction and focused checks, `worker` for bounded implementation, and `reviewer` for final risk review.
- Prefer parallel read-heavy work. Do not run parallel write agents against overlapping files or shared interfaces.
- Keep delegated tasks narrow and return concise summaries rather than raw logs to the primary agent.
