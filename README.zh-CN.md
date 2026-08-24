# Realtime Interview

[English](README.md) | [简体中文](README.zh-CN.md)

Realtime Interview 是一个可自托管、支持组织隔离的实时面试工作区。它结合了浏览器音频采集、云端语音识别、翻译、协作式逐字稿、笔记，以及 AI 辅助的面试聊天。

本仓库是一个 pnpm/Turborepo monorepo，包含 Next.js Web 应用、专用 WebSocket 实时网关、共享面试逻辑，以及 PostgreSQL/Prisma 数据层。

## 演示视频

[![观看 Realtime Interview 演示视频](docs/assets/realtime-interview-demo-cover.jpg)](docs/assets/realtime-interview-demo.mp4)

点击图片即可观看约 2 分钟的产品演示，视频包含中英文字幕。

## 功能

- 按组织隔离的面试房间和访问控制
- 通过 WebSocket 进行实时 PCM16 音频流传输
- 阿里云 Paraformer 实时 ASR，或兼容 OpenAI 的 ASR 后备方案
- 实时逐字稿分段和可选翻译
- 协作消息、笔记、提及和 AI 辅助提示
- 密码认证，并可选配 OAuth、邮件、S3、分析和计费
- 生产部署时分离运行 Web 和实时进程

## 前置条件

- Node.js 20 或更新版本
- pnpm 9.3.0
- PostgreSQL
- 至少一个受支持的云 ASR 服务商，用于实时转写

## 快速开始

```bash
pnpm install --frozen-lockfile
cp .env.prod.example .env
```

编辑 `.env` 并设置核心值：

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/realtime_interview"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/realtime_interview"
BETTER_AUTH_SECRET="replace-with-a-random-secret"
REALTIME_AUTH_SECRET="replace-with-a-different-random-secret"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_INTERVIEW_REALTIME_URL="ws://localhost:3001"
INTERVIEW_ALLOWED_ORIGIN="http://localhost:3000"
```

请使用密码管理器或例如 `openssl rand -base64 32` 生成安全的本地密钥。绝不要将凭据放入 `NEXT_PUBLIC_*` 变量。

准备一个全新数据库，并同时启动两个进程：

```bash
pnpm --filter @repo/database generate
pnpm --filter @repo/database migrate:deploy
pnpm dev
```

打开 `http://localhost:3000`。实时网关监听于 `ws://localhost:3001`；其 HTTP 健康检查可通过 `http://127.0.0.1:3001/health` 访问。

如需在本地迭代 schema，请使用 `pnpm --filter @repo/database migrate`。如果数据库之前通过 `prisma db push` 创建，请在使用仓库中提交的迁移之前先对其进行 baseline。请参阅[环境指南](docs/environment.md)。

## 云服务

应用无需配置每一项可选集成也可以启动，但相关功能需要配置对应服务商：

| 能力 | 配置 |
| --- | --- |
| 实时 ASR | `DASHSCOPE_API_KEY` 和 `ALIYUN_ASR_*` |
| ASR 后备方案 | `CLOUD_ASR_API_KEY`、`CLOUD_ASR_BASE_URL`、`CLOUD_ASR_MODEL` |
| 翻译 | `TRANSLATION_API_KEY`、`TRANSLATION_BASE_URL`、`TRANSLATION_MODEL` |
| 面试 Agent | `AGENT_API_KEY`、`AGENT_BASE_URL`、`AGENT_MODEL` |
| 事务邮件 | `MAIL_HOST`、`MAIL_PORT`、`MAIL_USER`、`MAIL_PASS`、`MAIL_FROM` |
| 头像和 Logo | `S3_*` 和 `NEXT_PUBLIC_AVATARS_BUCKET_NAME` |

完整的环境变量约定和服务商优先级说明见 [docs/environment.md](docs/environment.md)。请将录音和逐字稿导出文件存放于私有且经过独立授权的存储中；公开图片 bucket 不适合保存面试数据。

## 常用命令

```bash
pnpm dev          # Web 和实时开发进程
pnpm lint         # Biome lint 检查
pnpm type-check   # 跨 workspace 的 TypeScript 检查
pnpm test         # workspace 单元测试
pnpm build        # 生产构建
pnpm check        # lint、类型检查和单元测试
```

Web 端到端测试使用 Playwright：

```bash
pnpm --filter @repo/web e2e:ci
```

## 生产部署

构建 Web 应用，并分别运行 Web 和实时服务：

```bash
pnpm build
pnpm --filter @repo/web start
pnpm --filter @repo/realtime start
```

实时服务器绑定到 `127.0.0.1`。请将其置于 TLS 反向代理之后，并转发 WebSocket 升级请求。nginx 配置示例位于 `deploy/nginx/app.example.com.conf`。

## 架构与数据处理

组件边界、认证、实时协议细节和面试数据流请参阅 [docs/architecture.md](docs/architecture.md)。

本应用会处理可能敏感的音频、逐字稿、翻译、消息和笔记。运营者需自行负责参与者同意、保留与删除策略、服务商披露、访问控制以及适用的隐私法律。不要在 issue 或 pull request 中提交生产数据、录音、数据库导出、凭据或包含面试内容的日志。

## 历史数据导入工具

`packages/database/scripts/migrate-funasr.ts` 是一个可选的、先预览后执行的导入工具，供拥有兼容历史数据的部署使用。它不属于常规安装流程。该工具要求显式提供源 URL、目标组织和所有者身份；在写入任何数据之前必须提供 `--apply`。绝不要公开其输入数据或输出日志。

## 贡献与安全

提交 pull request 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。请按照 [SECURITY.md](SECURITY.md) 的说明私下报告安全或隐私问题，不要通过公开 issue 报告。将仓库公开前，请完成[开源发布检查清单](docs/open-source-release.md)。

## 许可证

Realtime Interview 使用 [GNU Affero General Public License v3.0](LICENSE)
许可证发布。
