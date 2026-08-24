# Environment contract

`user-interview` uses the SaaS conventions from `oneband-platform` and keeps a
small compatibility surface for migrating the cloud-only FunASR capabilities.
Real credentials belong in an ignored local `.env` or the deployment platform's
secret store. Never commit them.

## Canonical application variables

Use these names in new TypeScript code:

- `DATABASE_URL` for application database traffic.
- `DIRECT_URL` for Prisma migrations and administrative connections.
- `BETTER_AUTH_SECRET` for Better Auth signing and sessions.
- `NEXT_PUBLIC_SITE_URL` for absolute URLs, callbacks, and invitations.
- `NEXT_PUBLIC_INTERVIEW_REALTIME_URL` for the browser-to-realtime WebSocket.
- `INTERVIEW_REALTIME_PORT` and `INTERVIEW_ALLOWED_ORIGIN` for the dedicated
  realtime gateway.
- `INTERVIEW_MAX_SESSION_MINUTES` caps cloud speech usage per recording session.
- `REALTIME_AUTH_SECRET` for short-lived interview tokens. If omitted, the
  implementation falls back to `BETTER_AUTH_SECRET`; a separate production
  secret is preferred.
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, and `MAIL_FROM` for SMTP.

`MAIL_PORT=465` uses implicit TLS; submission ports such as `587` use STARTTLS.
Set `MAIL_FROM` to a valid sender (for example,
`Realtime Interview <hello@example.com>`). Keep explanatory comments on a
separate line: comments inside quoted dotenv values become part of the sender.
- `S3_ENDPOINT`, `S3_REGION`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, and
  `S3_SECRET_ACCESS_KEY` for the current avatar/logo storage adapter.

Do not reuse the avatar bucket for interview recordings or exports. Those
objects need separate private buckets, organization-scoped prefixes, content
type/size limits, and server-side authorization before signed URLs are issued.

Do not introduce the old FunASR `DATABASE_HOST`, `DATABASE_PASSWORD`,
`AUTH_SECRET`, or `SMTP_*` names into new modules.

## Database rollout

The checked-in Prisma migration is an initial migration for a fresh database.
Run `prisma migrate deploy` directly only for a new database. If an environment
already created the template tables with `prisma db push`, baseline that schema
before deploying migrations; do not run the initial SQL over existing tables.

### FunASR data import

The idempotent importer reads `FUNASR_SOURCE_DATABASE_URL`,
`ONEBAND_SOURCE_DATABASE_URL`, `FUNASR_TARGET_ORGANIZATION_ID`, and
`ONEBAND_DEFAULT_OWNER_EMAIL` from the ignored local `.env`. The owner email
must identify an existing target member and has no built-in default. Run a
read-only preview first, then explicitly apply it:

```bash
pnpm --filter @repo/database migrate:funasr
pnpm --filter @repo/database migrate:funasr -- --apply
```

Rooms, messages, notes, and transcript segments come from FunASR. The target
organization, users, credential accounts, and existing memberships come from
oneband. Every verified FunASR user with a password is added to the target
organization: matching oneband identities are reused, while other registered
users are imported with their legacy credential. The authentication layer can
verify the legacy PBKDF2-SHA256 password format alongside Better Auth Scrypt;
new and reset passwords continue to use Scrypt.
Room creator IDs are audit fields only; room ownership and visibility are
always determined by `organizationId` and organization membership.

## Temporary FunASR mapping

When porting behavior from the Python service, map legacy names at the adapter
boundary:

| FunASR name | user-interview name |
| --- | --- |
| `AUTH_SECRET` | `BETTER_AUTH_SECRET` |
| `SMTP_HOST` | `MAIL_HOST` |
| `SMTP_PORT` | `MAIL_PORT` |
| `SMTP_USER` | `MAIL_USER` |
| `SMTP_PASSWORD` | `MAIL_PASS` |
| `SMTP_FROM` | `MAIL_FROM` |
| split `DATABASE_*` fields | `DATABASE_URL` and `DIRECT_URL` |
| `OPENAI_API_BASE` | `OPENAI_BASE_URL` |
| `ALIYUN_API_KEY` | `DASHSCOPE_API_KEY` |
| `OPENAI_ASR_MODEL` | `CLOUD_ASR_MODEL` |
| `OPENAI_TRANSLATION_MODEL` | `TRANSLATION_MODEL` |
| `OPENAI_AGENT_MODEL` | `AGENT_MODEL` |

The compatibility aliases should not spread beyond provider adapters.

## Cloud-only speech and AI

These variables are consumed by the TypeScript interview capability package and
the dedicated realtime gateway. No Python inference service is required.

The preferred realtime speech path is Aliyun Paraformer, configured with
`DASHSCOPE_API_KEY` and `ALIYUN_ASR_*`. `CLOUD_ASR_*` is an optional
OpenAI-compatible fallback. Translation and Agent calls use their dedicated
`TRANSLATION_*` and `AGENT_*` variables. New adapters should prefer their
service-specific key/base/model and then fall back to `OPENAI_API_KEY` and
`OPENAI_BASE_URL`; this precedence is covered by provider contract tests.

The browser selects Aliyun realtime ASR or the OpenAI-compatible utterance ASR
for each session. `CLOUD_ASR_API_KEY` and `TRANSLATION_BASE_URL` are supported
alongside the other service-specific settings in `.env.prod.example`.

`pnpm dev` starts the web app and realtime workspace together. In production,
deploy the realtime process separately with `pnpm --filter @repo/realtime start`
and expose it through the public `wss://` URL configured above.

## Explicitly excluded local-model variables

The following do not belong in this project:

- `FUNASR_MODEL`
- `FUNASR_VAD_MODEL`
- `FUNASR_PUNC_MODEL`
- `FUNASR_SPK_MODEL`
- `FUNASR_DEVICE`
- `FUNASR_HUB`
- local runtime Python/binary paths
- GPU memory, CUDA, model length, and local decode-window settings

## Public variables

Every `NEXT_PUBLIC_*` value is delivered to the browser. Store identifiers and
public URLs there, never API keys, database credentials, or signing secrets.
