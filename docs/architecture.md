# Architecture and data flow

## Components

- `apps/web`: Next.js user interface and HTTP entry point.
- `packages/api`: Hono API routes, session checks, and organization-scoped
  authorization.
- `apps/realtime`: WebSocket gateway for browser audio and room broadcasts.
- `packages/interview`: tokens, providers, segmentation, translation, agent
  behavior, and interview domain logic.
- `packages/database`: Prisma schema, client, migrations, and the optional
  legacy importer.
- `packages/auth`: Better Auth configuration and migrated-password support.
- `packages/mail`, `packages/storage`, and `packages/payments`: optional external
  service adapters.

## Request and realtime flow

1. The browser calls the Next.js `/api/*` routes backed by Hono.
2. API routes validate the Better Auth session and organization membership
   before reading or changing interview data.
3. The browser requests a short-lived realtime token for a specific interview.
4. The browser opens the configured WebSocket URL. The realtime gateway checks
   the allowed origin, validates the token, and verifies interview access.
5. The first WebSocket message configures the session. Subsequent binary frames
   contain PCM16 audio and are limited to 64 KiB per frame.
6. The gateway sends audio to the selected cloud ASR provider. Final segments
   can be translated, persisted, and broadcast to authorized connections in the
   same interview room.
7. Transcript context may be sent to the configured interview-agent provider
   when a user invokes that feature.

The default maximum realtime session is 120 minutes and is configurable with
`INTERVIEW_MAX_SESSION_MINUTES`.

## Trust boundaries

- `NEXT_PUBLIC_*` values are public browser configuration and must never contain
  credentials.
- Better Auth and realtime signing secrets remain server-side.
- PostgreSQL contains account and interview content and must not be exposed to
  the browser or public network.
- ASR, translation, and agent providers receive the content required for the
  requested feature. Operators must disclose these processors to participants.
- Avatar/logo storage is public-image infrastructure. Interview audio and
  exports require separate private buckets, organization-scoped object keys,
  server-side authorization, and short-lived download URLs.
- The `/health` endpoint only reports realtime process health. WebSocket access
  still requires database-backed authorization.

## Sensitive data

Interview audio, participant identity, transcripts, translations, messages,
notes, session metadata, and generated responses should all be treated as
sensitive. A production deployment should define:

- informed participant consent;
- a retention and deletion schedule;
- organization-level export and deletion procedures;
- restricted production and support access;
- log redaction and incident response;
- the regions and subprocessors used by cloud providers.

No production database dump, recording, transcript, credential, password hash,
or content-bearing log belongs in this repository.
