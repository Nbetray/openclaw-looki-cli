# openclaw-looki-cli

用于安装和配置 `@nbetray/openclaw-looki@latest` 的命令行向导。

## 要求

- Node.js `>= 22`
- OpenClaw `>= 2026.3.24`

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
- 可选配置飞书(FeiShu)或微信(Weixin)转发
- 写入配置并重启 OpenClaw Gateway

环境对应地址：

- `Global` → `https://open.looki.ai`
- `China` → `https://open.looki.tech`

## 飞书(FeiShu)转发说明

- 检测到 `openclaw-lark` 时可配置转发
- `to` 需要填写目标飞书(FeiShu)用户的 `open_id`
- 安装器不会自动帮你填写默认 `to`

## 微信(Weixin)转发说明

- 检测到 `openclaw-weixin` 时可配置转发
- 需要先完成微信登录：`openclaw channels login --channel openclaw-weixin`
- 需要使用支持跨 channel outbound adapter 的 OpenClaw 版本（建议 `>= 2026.4.22`）
- `accountId` 建议填写已登录的微信账号 ID；安装器会尝试读取本地已登录账号作为默认值
- `to` 需要填写微信插件收到的目标用户 ID，不是昵称；安装器会尝试从本地 `context-tokens.json` 读取并预填候选
- 目标用户最好先给微信 bot 发过消息，以便微信插件缓存发送所需的 `context_token`

## 许可证

本项目使用 MIT License。
