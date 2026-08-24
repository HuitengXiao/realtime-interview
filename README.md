# Realtime Interview

[English](README.md) | [简体中文](README.zh-CN.md)

Realtime Interview is a self-hosted, organization-aware workspace for live
interviews. It combines browser audio capture, cloud speech recognition,
translation, collaborative transcripts, notes, and AI-assisted interview chat.

The repository is a pnpm/Turborepo monorepo containing a Next.js web app, a
dedicated WebSocket realtime gateway, shared interview logic, and a
PostgreSQL/Prisma data layer.

## Demo video

[![Watch the Realtime Interview demo](docs/assets/realtime-interview-demo-cover.jpg)](docs/assets/realtime-interview-demo.mp4)

Click the image to watch the 2-minute product walkthrough with Chinese and
English subtitles.

## Features

- Organization-scoped interview rooms and access control
- Realtime PCM16 audio streaming over WebSocket
- Aliyun Paraformer realtime ASR or an OpenAI-compatible ASR fallback
- Live transcript segmentation and optional translation
- Collaborative messages, notes, mentions, and AI-assisted prompts
- Password authentication with optional OAuth, mail, S3, analytics, and billing
- Separate web and realtime processes for production deployment

## Prerequisites

- Node.js 20 or newer
- pnpm 9.3.0
- PostgreSQL
- At least one supported cloud ASR provider for live transcription

## Quick start

```bash
pnpm install --frozen-lockfile
cp .env.prod.example .env
```

Edit `.env` and set the core values:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realtime_interview"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/realtime_interview"
BETTER_AUTH_SECRET="replace-with-a-random-secret"
REALTIME_AUTH_SECRET="replace-with-a-different-random-secret"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_INTERVIEW_REALTIME_URL="ws://localhost:3001"
INTERVIEW_ALLOWED_ORIGIN="http://localhost:3000"
```

Generate secure local secrets with a password manager or, for example,
`openssl rand -base64 32`. Never put credentials in a `NEXT_PUBLIC_*` variable.

Prepare a fresh database and start both processes:

```bash
pnpm --filter @repo/database generate
pnpm --filter @repo/database migrate:deploy
pnpm dev
```

Open `http://localhost:3000`. The realtime gateway listens at
`ws://localhost:3001`; its HTTP health check is available at
`http://127.0.0.1:3001/health`.

For local schema iteration, use `pnpm --filter @repo/database migrate`. If a
database was previously created with `prisma db push`, baseline it before using
the checked-in migrations. See [the environment guide](docs/environment.md).

## Cloud services

The application starts without every optional integration, but the associated
features require their provider configuration:

| Capability | Configuration |
| --- | --- |
| Realtime ASR | `DASHSCOPE_API_KEY` and `ALIYUN_ASR_*` |
| ASR fallback | `CLOUD_ASR_API_KEY`, `CLOUD_ASR_BASE_URL`, `CLOUD_ASR_MODEL` |
| Translation | `TRANSLATION_API_KEY`, `TRANSLATION_BASE_URL`, `TRANSLATION_MODEL` |
| Interview agent | `AGENT_API_KEY`, `AGENT_BASE_URL`, `AGENT_MODEL` |
| Transactional mail | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` |
| Avatars and logos | `S3_*` and `NEXT_PUBLIC_AVATARS_BUCKET_NAME` |

The complete contract and provider precedence are documented in
[docs/environment.md](docs/environment.md). Keep recordings and transcript
exports in private, separately authorized storage; the public-image bucket is
not suitable for interview data.

## Common commands

```bash
pnpm dev          # web and realtime development processes
pnpm lint         # Biome lint checks
pnpm type-check   # TypeScript checks across workspaces
pnpm test         # workspace unit tests
pnpm build        # production build
pnpm check        # lint, type-check, and unit tests
```

Web end-to-end tests use Playwright:

```bash
pnpm --filter @repo/web e2e:ci
```

## Production deployment

Build the web application and run the web and realtime services separately:

```bash
pnpm build
pnpm --filter @repo/web start
pnpm --filter @repo/realtime start
```

The realtime server binds to `127.0.0.1`. Put it behind a TLS reverse proxy and
forward WebSocket upgrades. An example nginx configuration is available at
`deploy/nginx/app.example.com.conf`.

## Architecture and data handling

See [docs/architecture.md](docs/architecture.md) for component boundaries,
authentication, realtime protocol details, and the interview data flow.

This application processes potentially sensitive audio, transcripts,
translations, messages, and notes. Operators are responsible for participant
consent, retention and deletion policies, provider disclosures, access control,
and applicable privacy law. Do not put production data, recordings, database
exports, credentials, or logs containing interview content in issues or pull
requests.

## Legacy data importer

`packages/database/scripts/migrate-funasr.ts` is an optional, preview-first
importer for deployments that own compatible legacy data. It is not part of the
normal setup path. It requires explicit source URLs, target organization, and
owner identity; `--apply` is required before it writes anything. Never publish
its input data or output logs.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report
security or privacy issues privately as described in [SECURITY.md](SECURITY.md),
not through a public issue. Before making a repository public, complete the
[open-source release checklist](docs/open-source-release.md).

## License

Realtime Interview is licensed under the
[GNU Affero General Public License v3.0](LICENSE).
