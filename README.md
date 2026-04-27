# openclaw-looki-cli

_English: [README.en.md](./README.en.md)_

[openclaw-looki](https://github.com/Nbetray/openclaw-looki) 插件的安装 / 重新
配置向导。

## 环境要求

- Node.js `>= 22`
- OpenClaw `>= 2026.4.24`

## 使用

```bash
npx -y @nbetray/openclaw-looki-cli@latest install
```

向导会完成：

- 安装或更新 `@nbetray/openclaw-looki`
- 选择 Looki 环境 + 填写 `apiKey`
- 检测并配置下游 IM 转发（飞书 / 微信 / QQ Bot / LINE / WhatsApp / Telegram /
  Discord）
- 写入 OpenClaw 配置并重启 Gateway

查看帮助：

```bash
npx -y @nbetray/openclaw-looki-cli@latest help
```

## 命令

| 命令        | 作用                                     |
| ----------- | ---------------------------------------- |
| `install`   | 安装 / 更新插件并运行完整向导            |
| `configure` | 插件已装好时，只重新跑配置向导（不重装） |
| `help`      | 显示帮助                                 |

## 选项

所有选项都同时适用于 `install` 和 `configure`。

| 选项               | 作用                                        |
| ------------------ | ------------------------------------------- |
| `--base-url <url>` | 跳过环境选择，直接使用指定 URL              |
| `--api-key <key>`  | 跳过 apiKey 交互                            |
| `--locale <code>`  | 强制指定界面语言：`zh-CN` 或 `en`           |
| `--no-restart`     | 写入配置后不执行 `openclaw gateway restart` |

非交互示例（CI 场景）：

```bash
npx -y @nbetray/openclaw-looki-cli@latest \
  --locale zh-CN --no-restart \
  --base-url https://open.looki.ai \
  --api-key "$LOOKI_API_KEY" \
  configure
```

## 界面语言持久化

第一次运行时你选的中文 / 英文会写入 `~/.openclaw/openclaw.json` 的
`openclaw-looki-cli.locale`。之后的运行会直接复用，除非你传 `--locale` 覆盖。

## 环境地址

- `Global` → `https://open.looki.ai`
- `China` → `https://open.looki.tech`

## 转发支持

安装器会检测已装的下游 IM 插件，逐个提示配置 `forwardTo`。当前支持：

- `feishu`：飞书 / Lark
- `openclaw-weixin`：微信 / WeChat
- `qqbot`：QQ Bot
- `line`
- `whatsapp`
- `telegram`
- `discord`

飞书的 `to` 需要在 Feishu 插件已有的 `allowFrom` 候选里；微信和 QQ Bot 会尽量
从本地状态（`openclaw-weixin/accounts/*.context-tokens.json` 和
`qqbot/data/known-users.json`）自动预填候选。

## 错误提示

`openclaw plugins install` / `update` / `gateway restart` 失败时，CLI 会打印
stderr，并尝试根据错误内容给出本地化的「提示」，覆盖常见原因：`openclaw` 不
在 PATH、权限问题（EACCES）、路径不存在（ENOENT）、以及网络/超时。

## 开发

```bash
npm install
npm run typecheck
npm run build
npm run lint
npm run format:check
```

构建产物位于 `dist/`；发布的可执行入口是 `dist/cli.js`。

## 许可证

MIT
