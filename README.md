# openclaw-looki-cli

用于安装和配置 `@nbetray/openclaw-looki@latest` 的命令行向导。

## 要求

- Node.js `>= 22`
- OpenClaw `>= 2026.4.24`

## 使用

```bash
npx -y @nbetray/openclaw-looki-cli@latest install
```

也可以先查看帮助：

```bash
npx -y @nbetray/openclaw-looki-cli@latest help
```

向导会完成：

- 安装或更新 Looki 插件
- 选择 Looki 环境
- 填写 `apiKey`
- 可选配置下游 IM 转发
- 写入配置并重启 OpenClaw Gateway

环境对应地址：

- `Global` → `https://open.looki.ai`
- `China` → `https://open.looki.tech`

## 转发支持

安装器会检测已安装的下游 IM 插件，并通过 Looki 的 `forwardTo` 写入统一 runtime outbound 配置。

当前支持：

- `feishu`：飞书 / Lark（由 `@larksuite/openclaw-lark` 提供）
- `openclaw-weixin`：微信 / WeChat
- `qqbot`：QQ Bot
- `line`：LINE
- `whatsapp`：WhatsApp
- `telegram`：Telegram
- `discord`：Discord

## 飞书 / Lark 转发说明

- 检测到 `@larksuite/openclaw-lark` / `feishu` 时可配置转发
- `to` 需要填写目标飞书 / Lark 用户的 `open_id`
- 安装器不会自动帮你填写默认 `to`

## 微信 / WeChat 转发说明

- 检测到 `openclaw-weixin` 时可配置转发
- 需要先完成微信登录：`openclaw channels login --channel openclaw-weixin`
- `accountId` 建议填写已登录的微信账号 ID；安装器会尝试读取本地已登录账号作为默认值
- `to` 需要填写微信插件收到的目标用户 ID，不是昵称；安装器会尝试从本地 `context-tokens.json` 读取并预填候选
- 目标用户最好先给微信 bot 发过消息，以便微信插件缓存发送所需的 `context_token`

## QQ Bot 转发说明

- 检测到 `qqbot` 时可配置转发
- 安装器会尝试读取本地 `~/.openclaw/qqbot/data/known-users.json`，并预填已见过的 QQ Bot 目标
- 私聊目标：让目标用户给 QQ Bot 发一句话；`to` 填 `qqbot:c2c:<user_openid>`
- 群聊目标：在目标群里 `@你的 Bot` 发一句话；`to` 填 `qqbot:group:<group_openid>`
- 频道目标：在频道里触发 Bot；`to` 填 `qqbot:channel:<channel_id>`
- `accountId` 可选；只有多个 QQ Bot 账号时才需要指定，通常可用 `default`

## 其他 IM 转发说明

- 检测到对应插件时可配置转发
- `accountId` 为可选项，按插件实际登录账号填写
- `to` 需要填写目标插件 outbound 能识别的会话、用户或频道 ID

## 许可证

本项目使用 MIT License。
