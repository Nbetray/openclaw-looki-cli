# openclaw-looki-cli

用于安装和配置 `@nbetray/openclaw-looki` 的命令行向导。

## 要求

- Node.js `>= 22`
- OpenClaw `>= 2026.3.24`

## 使用

```bash
npx -y @nbetray/openclaw-looki-cli install
```

也可以先查看帮助：

```bash
npx -y @nbetray/openclaw-looki-cli help
```

向导会完成：

- 安装或更新 Looki 插件
- 选择 Looki 环境
- 填写 `apiKey`
- 可选配置飞书(FeiShu)转发
- 写入配置并重启 OpenClaw Gateway

环境对应地址：

- `Global` → `https://open.looki.ai`
- `China` → `https://open.looki.tech`

## 飞书(FeiShu)转发说明

- 检测到 `openclaw-lark` 时可配置转发
- `to` 需要填写目标飞书(FeiShu)用户的 `open_id`
- 安装器不会自动帮你填写默认 `to`

## 许可证

本项目使用 MIT License。
