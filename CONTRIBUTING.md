# Contributing to Realtime Interview

Thanks for helping improve Realtime Interview. Contributions of bug fixes,
documentation, tests, accessibility improvements, and small focused features
are welcome.

## Before you start

- Search existing issues and pull requests before opening a new one.
- For substantial changes, open an issue first so the scope and approach can
  be discussed.
- Keep pull requests focused. Include tests when behavior changes, and update
  documentation when setup, configuration, or user-facing behavior changes.
- Follow the repository's existing formatting, naming, and package boundaries.

## Local checks

Install dependencies with `pnpm install`, then run the checks relevant to your
change. Run `pnpm check` before requesting review; it runs lint, workspace type
checks, and unit tests. For production-sensitive changes, also run `pnpm build`.
Do not commit generated build output, local databases, or `.env` files.

## Privacy and sensitive data

This project processes interview material. Never include any of the following
in issues, pull requests, commits, screenshots, test fixtures, or logs:

- credentials, API keys, tokens, private keys, cookies, or `.env` files;
- audio/video recordings or other media from real interviews;
- transcripts, translations, chat messages, notes, evaluations, or personal
  data from real interview participants;
- production database exports, identifiers, or internal service URLs.

Use synthetic data and clearly fictional names in examples and tests. If you
accidentally disclose sensitive information, revoke affected credentials where
applicable and report the incident privately as described in
[SECURITY.md](SECURITY.md); do not open a public issue.

## Pull requests

Explain the problem, the chosen solution, and how you tested it. Call out
breaking changes, migrations, environment-variable changes, and any privacy or
security implications. By contributing, you agree that your contribution may
be distributed under this repository's license.
