# Open-source release checklist

Complete this checklist before changing repository visibility to public.

## Rights and license

- Confirm that the project baseline and all migrated code can be redistributed.
- Confirm redistribution rights for every image, icon, font, screenshot, and
  document under `apps/web/public`.
- Choose and add a `LICENSE` file. Do not add a license that grants rights you do
  not own.
- Update repository metadata and package documentation to name the license.

## Sensitive data

- Scan the current tree and every Git ref with a secret scanner such as Gitleaks
  or TruffleHog.
- Confirm that no `.env`, certificate key, database export, recording,
  transcript, participant data, password hash, production log, or storage
  export is tracked.
- Revoke credentials found in any commit before removing them from history.
- Review commit author names and email addresses and obtain consent to publish
  them or anonymize the public history.
- Review screenshots and binary assets visually; text-only scans do not detect
  QR codes, faces, phone numbers rendered as images, or embedded metadata.

Deleting a file in a new commit does not remove it from earlier commits. Create
a new repository from a clean export, or deliberately rewrite history and
verify a fresh clone before publishing. History rewriting changes commit IDs
and requires coordination with every existing clone, so it should never be run
as an incidental cleanup step.

## Product safety

- Replace the legal placeholder pages with policies for the actual operator
  before accepting real interview data.
- Configure a private vulnerability-reporting channel in repository settings
  and update `SECURITY.md` if a public security address is available.
- Define participant consent, subprocessors, processing regions, retention,
  export, deletion, support access, and incident response.
- Ensure interview recordings and exports use private storage rather than the
  public avatar/logo bucket.

## Verification

Run from a fresh clone with synthetic configuration:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Then initialize a fresh PostgreSQL database, start both services, verify the
realtime `/health` endpoint, and complete one interview using only synthetic
content. Review the resulting release archive as well as the Git tree.
