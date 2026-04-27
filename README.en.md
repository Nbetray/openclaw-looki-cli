# openclaw-looki-cli

A guided installer and re-configurator for the [openclaw-looki](https://github.com/Nbetray/openclaw-looki)
OpenClaw channel plugin.

_中文文档：[README.md](./README.md)_

## Requirements

- Node.js `>= 22`
- OpenClaw `>= 2026.4.24`

## Quick start

```bash
npx -y @nbetray/openclaw-looki-cli@latest install
```

The wizard will:

- install or update `@nbetray/openclaw-looki`
- prompt for Looki environment and API key
- detect downstream IM plugins (Feishu / WeChat / QQ Bot / LINE / WhatsApp /
  Telegram / Discord) and configure `forwardTo` for each that you pick
- write the OpenClaw config and restart the gateway

Help and environment list:

```bash
npx -y @nbetray/openclaw-looki-cli@latest help
```

## Commands

| Command     | What it does                                          |
| ----------- | ----------------------------------------------------- |
| `install`   | Install / update the plugin, then run the full wizard |
| `configure` | Re-run the wizard against an already-installed plugin |
| `help`      | Show usage                                            |

## Options

All options work with both `install` and `configure`.

| Option             | Effect                                                   |
| ------------------ | -------------------------------------------------------- |
| `--base-url <url>` | Skip the environment prompt and use this URL verbatim    |
| `--api-key <key>`  | Skip the API key prompt                                  |
| `--locale <code>`  | Force interface language: `zh-CN` or `en`                |
| `--no-restart`     | Skip `openclaw gateway restart` after writing the config |

Example non-interactive use in CI:

```bash
npx -y @nbetray/openclaw-looki-cli@latest \
  --locale en --no-restart \
  --base-url https://open.looki.ai \
  --api-key "$LOOKI_API_KEY" \
  configure
```

## Interface language persistence

The first time you run the wizard you pick Chinese or English. The choice is
saved under `openclaw-looki-cli.locale` in `~/.openclaw/openclaw.json`; later
runs reuse it unless you pass `--locale`.

## Environments

- `Global` → `https://open.looki.ai`
- `China` → `https://open.looki.tech`

## Forwarding

The installer inspects `~/.openclaw/openclaw.json` for installed downstream IM
plugins and offers to configure forwarding for each. Currently supported:

- `feishu` — Feishu / Lark
- `openclaw-weixin` — WeChat
- `qqbot` — QQ Bot
- `line`
- `whatsapp`
- `telegram`
- `discord`

Feishu will only accept a `to` that appears in the channel's existing
`allowFrom` candidates. WeChat and QQ Bot auto-populate candidate lists from
local state when available (`openclaw-weixin/accounts/*.context-tokens.json`
and `qqbot/data/known-users.json`).

## Error hints

If `openclaw plugins install` / `openclaw plugins update` /
`openclaw gateway restart` fails, the CLI prints the raw stderr plus a
localized hint for common root causes (`openclaw` not on PATH, `EACCES`,
`ENOENT`, network timeouts).

## Development

```bash
npm install
npm run typecheck
npm run build
npm run lint
npm run format:check
```

The build output lives in `dist/`; the published bin is `dist/cli.js`.

## License

MIT.
