#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cancel,
  intro,
  isCancel,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";

const PLUGIN_SPEC = "@nbetray/openclaw-looki";
const CHANNEL_ID = "openclaw-looki";
const MIN_OPENCLAW_VERSION = "2026.3.24";
const MIN_WEIXIN_OUTBOUND_VERSION = "2026.4.22";
const DEFAULT_LOCALE = "zh-CN";
const GLOBAL_BASE_URL = "https://open.looki.ai";
const CHINA_BASE_URL = "https://open.looki.tech";
const UI_LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "中文", hint: "简体中文 / Simplified Chinese" },
  { value: "en", label: "English", hint: "英文 / English" },
];
const SUPPORTED_FORWARD_PLUGINS = [
  {
    id: "openclaw-lark",
    detectIds: ["openclaw-lark"],
    label: "飞书(FeiShu)",
    channel: "feishu",
    accountId: "default",
    hint: "把 Looki 的 Agent 输出转发到飞书(FeiShu)",
  },
  {
    id: "openclaw-weixin",
    detectIds: ["openclaw-weixin", "@tencent-weixin/openclaw-weixin"],
    label: "微信(Weixin)",
    channel: "openclaw-weixin",
    hint: "把 Looki 的 Agent 输出转发到微信(Weixin)",
  },
];

let currentLocale = DEFAULT_LOCALE;

const MESSAGES = {
  "zh-CN": {
    cancelled: "已取消 Looki 安装",
    openclawMissing: "未找到 openclaw，请先安装：",
    docsHint: "  详见 https://docs.openclaw.ai/install",
    openclawFound: "已找到本地安装的 openclaw",
    versionMissing: "无法获取 openclaw 版本号，请确认 `openclaw --version` 正常工作",
    versionTooLow: ({ version }) => `当前 OpenClaw 版本 ${version} 过低，需要 >= ${MIN_OPENCLAW_VERSION}`,
    weixinVersionTooLow: ({ version }) =>
      `当前 OpenClaw 版本 ${version} 不支持微信跨 channel 转发，需要 >= ${MIN_WEIXIN_OUTBOUND_VERSION}`,
    versionDetected: ({ version }) => `检测到 OpenClaw 版本: ${version}`,
    requiredField: "该项必填",
    invalidAllowFrom: "请填写正确的 allowFrom",
    installStart: `正在安装插件 ${PLUGIN_SPEC}`,
    installDone: "Looki 插件安装完成",
    installUpdate: "检测到本地已安装，开始更新",
    installUpdated: "Looki 插件更新完成",
    installFailed: "Looki 插件安装失败",
    installFailedManual: "插件安装失败，请手动执行：",
    updateFailedManual: "插件更新失败，请手动执行：",
    restartStart: "正在重启 OpenClaw Gateway",
    restartDone: "OpenClaw Gateway 已重启",
    restartFailed: "OpenClaw Gateway 重启失败",
    restartFailedManual: "重启失败，可手动执行：",
    intro: "OpenClaw Looki 安装向导",
    languageTitle: "界面语言",
    languageMessage: "选择界面语言（仅影响当前向导，不会写入配置）",
    envTitle: "环境选择",
    envNote: "第一步：选择部署环境，对应写入 Looki 的 baseUrl。",
    envMessage: "请选择环境",
    envOptionGlobal: "Global",
    envOptionChina: "China",
    envHintGlobal: "海外环境",
    envHintChina: "中国大陆环境",
    apiKeyTitle: "API Key",
    apiKeyNote: "第二步：填写 Looki 的 API Key。",
    apiKeyMessage: "请输入 apiKey",
    pluginTitle: "插件检测",
    pluginNone: "当前未检测到可转发插件，先只保存 Looki 基础配置。",
    pluginDetected: ({ labels }) => `检测到已安装插件：${labels}`,
    listControlsTitle: "操作提示",
    listControls: "Enter 配置 · Esc 退出",
    pageControlsTitle: "页面操作",
    pageControlsConfigured: "Enter 选择操作：修改、取消配置、返回",
    pageControlsUnconfigured: "Enter 进入填写页，Esc 返回列表",
    actionMessage: ({ label }) => `${label} 操作`,
    actionEdit: "修改配置",
    actionEditHint: "重新填写 to",
    actionClear: "取消配置",
    actionClearHint: "移除这一项的转发配置",
    actionBack: "返回",
    actionBackHint: "回到插件列表",
    allowFromTitle: "飞书(FeiShu)候选",
    allowFromDetected: ({ values }) => `检测到现有飞书(FeiShu) allowFrom：${values}`,
    feishuToMessage: "填写飞书(FeiShu) to（Esc 返回）",
    weixinAccountsTitle: "微信(Weixin)账号",
    weixinAccountsDetected: ({ values }) => `检测到已登录微信账号：${values}`,
    weixinUsersTitle: "微信(Weixin)用户候选",
    weixinUsersDetected: ({ values }) => `检测到可发送的微信用户 ID：${values}`,
    weixinAccountIdMessage: "填写微信(Weixin) accountId（Esc 返回）",
    weixinToMessage: "填写微信(Weixin) to / user_id（Esc 返回）",
    forwardTargetMessage: "请选择需要转发 Agent 输出的聊天插件",
    doneLabel: "完成",
    doneHint: ({ count }) => (count > 0 ? `已完成 ${count} 项` : "暂不配置转发"),
    configuredHint: ({ value }) => `已填写 ${value}`,
    invalidHint: ({ value }) => `未完成：${value}`,
    emptyHint: "未填写",
    configWritten: ({ path }) => `配置已写入：${path}`,
    configWrittenTitle: "配置完成",
    outro: "Looki 安装完成",
    helpUsage: "  用法: npx -y @nbetray/openclaw-looki-cli <命令>",
    helpCommands: "  命令:",
    helpInstall: "    install   安装 Looki 插件并完成基础配置",
    helpHelp: "    help      显示帮助信息",
    unknownCommand: ({ command }) => `未知命令: ${command}`,
  },
  en: {
    cancelled: "Looki install cancelled",
    openclawMissing: "OpenClaw was not found. Please install it first:",
    docsHint: "  Docs: https://docs.openclaw.ai/install",
    openclawFound: "Found a local OpenClaw installation",
    versionMissing: "Could not detect the OpenClaw version. Please make sure `openclaw --version` works.",
    versionTooLow: ({ version }) => `OpenClaw ${version} is too old. Required: >= ${MIN_OPENCLAW_VERSION}`,
    weixinVersionTooLow: ({ version }) =>
      `OpenClaw ${version} does not support Weixin cross-channel forwarding. Required: >= ${MIN_WEIXIN_OUTBOUND_VERSION}`,
    versionDetected: ({ version }) => `Detected OpenClaw version: ${version}`,
    requiredField: "This field is required",
    invalidAllowFrom: "Please enter a valid allowFrom value",
    installStart: `Installing plugin ${PLUGIN_SPEC}`,
    installDone: "Looki plugin installed",
    installUpdate: "Plugin already installed, updating",
    installUpdated: "Looki plugin updated",
    installFailed: "Looki plugin install failed",
    installFailedManual: "Plugin install failed. Please run it manually:",
    updateFailedManual: "Plugin update failed. Please run it manually:",
    restartStart: "Restarting OpenClaw Gateway",
    restartDone: "OpenClaw Gateway restarted",
    restartFailed: "OpenClaw Gateway restart failed",
    restartFailedManual: "Restart failed. You can run this manually:",
    intro: "OpenClaw Looki installer",
    languageTitle: "Language",
    languageMessage: "Choose the interface language (only for this wizard, not saved)",
    envTitle: "Environment",
    envNote: "Step 1: choose the deployment environment. This controls Looki baseUrl.",
    envMessage: "Choose environment",
    envOptionGlobal: "Global",
    envOptionChina: "China",
    envHintGlobal: "Global deployment",
    envHintChina: "Mainland China deployment",
    apiKeyTitle: "API Key",
    apiKeyNote: "Step 2: enter the Looki API key.",
    apiKeyMessage: "Enter apiKey",
    pluginTitle: "Plugin Detection",
    pluginNone: "No forwarding plugins were detected. Only the basic Looki config will be saved.",
    pluginDetected: ({ labels }) => `Detected installed plugins: ${labels}`,
    listControlsTitle: "Hint",
    listControls: "Enter to configure · Esc to exit",
    pageControlsTitle: "Page",
    pageControlsConfigured: "Enter to choose: edit, clear, or back",
    pageControlsUnconfigured: "Enter to configure · Esc to go back",
    actionMessage: ({ label }) => `${label} actions`,
    actionEdit: "Edit",
    actionEditHint: "Enter or update the target",
    actionClear: "Clear",
    actionClearHint: "Remove this forwarding target",
    actionBack: "Back",
    actionBackHint: "Return to the plugin list",
    allowFromTitle: "FeiShu Candidates",
    allowFromDetected: ({ values }) => `Detected FeiShu allowFrom values: ${values}`,
    feishuToMessage: "Enter FeiShu to (Esc to go back)",
    weixinAccountsTitle: "Weixin Accounts",
    weixinAccountsDetected: ({ values }) => `Detected logged-in Weixin accounts: ${values}`,
    weixinUsersTitle: "Weixin User Candidates",
    weixinUsersDetected: ({ values }) => `Detected sendable Weixin user IDs: ${values}`,
    weixinAccountIdMessage: "Enter Weixin accountId (Esc to go back)",
    weixinToMessage: "Enter Weixin to / user_id (Esc to go back)",
    forwardTargetMessage: "Choose chat plugins for Agent output forwarding",
    doneLabel: "Done",
    doneHint: ({ count }) => (count > 0 ? `${count} configured` : "Skip forwarding for now"),
    configuredHint: ({ value }) => `Configured: ${value}`,
    invalidHint: ({ value }) => `Incomplete: ${value}`,
    emptyHint: "Not configured",
    configWritten: ({ path }) => `Configuration written to: ${path}`,
    configWrittenTitle: "Saved",
    outro: "Looki install complete",
    helpUsage: "  Usage: npx -y @nbetray/openclaw-looki-cli <command>",
    helpCommands: "  Commands:",
    helpInstall: "    install   Install the Looki plugin and complete basic setup",
    helpHelp: "    help      Show help",
    unknownCommand: ({ command }) => `Unknown command: ${command}`,
  },
};

function t(key, params = {}) {
  const entry = MESSAGES[currentLocale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key];
  return typeof entry === "function" ? entry(params) : entry;
}

function getBaseUrlOptions() {
  return [
    { label: t("envOptionGlobal"), value: GLOBAL_BASE_URL, hint: t("envHintGlobal") },
    { label: t("envOptionChina"), value: CHINA_BASE_URL, hint: t("envHintChina") },
  ];
}

function normalizeBaseUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "A") return GLOBAL_BASE_URL;
  if (trimmed === "B") return CHINA_BASE_URL;
  return trimmed;
}

function log(message) {
  console.log(`\x1b[36m[openclaw-looki]\x1b[0m ${message}`);
}

function error(message) {
  console.error(`\x1b[31m[openclaw-looki]\x1b[0m ${message}`);
}

function guardCancel(value) {
  if (isCancel(value)) {
    cancel(t("cancelled"));
    process.exit(0);
  }
  return value;
}

function run(cmd, { silent = true } = {}) {
  const stdio = silent ? ["pipe", "pipe", "pipe"] : "inherit";
  const result = spawnSync(cmd, { shell: true, stdio });
  if (result.status !== 0) {
    const err = new Error(`Command failed with exit code ${result.status}: ${cmd}`);
    err.stderr = silent ? (result.stderr || "").toString() : "";
    throw err;
  }
  return silent ? (result.stdout || "").toString().trim() : "";
}

function which(bin) {
  const cmd = process.platform === "win32" ? `where ${bin}` : `which ${bin}`;
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function parseVersion(version) {
  const match = String(version).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return Number.NaN;
  for (let index = 0; index < 3; index += 1) {
    if (va[index] !== vb[index]) return va[index] - vb[index];
  }
  return 0;
}

function getOpenclawVersion() {
  try {
    const raw = run("openclaw --version");
    const match = raw.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function ensureOpenclawInstalled() {
  if (!which("openclaw")) {
    error(t("openclawMissing"));
    console.log("  npm install -g openclaw");
    console.log(t("docsHint"));
    process.exit(1);
  }
  log(t("openclawFound"));
}

function ensureHostVersion() {
  const version = getOpenclawVersion();
  if (!version) {
    error(t("versionMissing"));
    process.exit(1);
  }

  if (compareVersions(version, MIN_OPENCLAW_VERSION) < 0) {
    error(t("versionTooLow", { version }));
    process.exit(1);
  }

  log(t("versionDetected", { version }));
  return version;
}

function getStateDir() {
  return process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), ".openclaw");
}

function getConfigPath() {
  return path.join(getStateDir(), "openclaw.json");
}

function readConfig() {
  const configPath = getConfigPath();
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  const stateDir = getStateDir();
  const configPath = getConfigPath();
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function getInstalledPlugins(config) {
  return config?.plugins?.installs || {};
}

function hasPluginInstalled(config, plugin) {
  const installs = config?.plugins?.installs || {};
  const entries = config?.plugins?.entries || {};
  const allow = Array.isArray(config?.plugins?.allow) ? config.plugins.allow : [];
  const detectIds = Array.isArray(plugin.detectIds) && plugin.detectIds.length > 0
    ? plugin.detectIds
    : [plugin.id];

  return detectIds.some((detectId) => Boolean(
    installs?.[detectId] ||
    entries?.[detectId]?.enabled === true ||
    allow.includes(detectId),
  )) || Boolean(config?.channels?.[plugin.channel]) || (
    plugin.channel === "openclaw-weixin" && getWeixinAccountIds().length > 0
  );
}

function detectForwardTargets(config) {
  return SUPPORTED_FORWARD_PLUGINS.filter((plugin) => hasPluginInstalled(config, plugin));
}

function getExistingFeishuAllowFrom(config) {
  const value = config?.channels?.feishu?.allowFrom;
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function getExistingForwardChannels(config) {
  const forwardTo = config?.channels?.[CHANNEL_ID]?.forwardTo;
  if (!Array.isArray(forwardTo)) return [];
  return forwardTo
    .map((entry) => String(entry?.channel ?? "").trim())
    .filter(Boolean);
}

function getWeixinAccountIds() {
  const filePath = path.join(getStateDir(), "openclaw-weixin", "accounts.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getWeixinContextUserIds(accountId) {
  const accountsDir = path.join(getStateDir(), "openclaw-weixin", "accounts");
  const candidateFiles = accountId
    ? [path.join(accountsDir, `${accountId}.context-tokens.json`)]
    : fs.existsSync(accountsDir)
      ? fs.readdirSync(accountsDir)
        .filter((name) => name.endsWith(".context-tokens.json"))
        .map((name) => path.join(accountsDir, name))
      : [];
  const ids = new Set();

  for (const filePath of candidateFiles) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      for (const key of Object.keys(parsed)) {
        const id = String(key).trim();
        if (id) ids.add(id);
      }
    } catch {
      // ignore missing or malformed token cache files
    }
  }

  return [...ids];
}

function isValidFeishuTo(value, candidates) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  if (candidates.length === 0) return true;
  return candidates.includes(trimmed);
}

async function promptSelect(message, options, initialValue) {
  return guardCancel(await select({
    message,
    options: options.map((option) => ({
      value: option.value,
      label: option.label,
      hint: option.hint,
    })),
    initialValue,
  }));
}

async function promptText(message, { placeholder, defaultValue, required = true } = {}) {
  return (guardCancel(await text({
    message,
    placeholder,
    initialValue: defaultValue,
    validate: (value) => {
      const trimmed = String(value ?? "").trim();
      if (!trimmed && required && !defaultValue) return t("requiredField");
      return undefined;
    },
  })) || defaultValue || "").trim();
}

async function promptTextOrBack(message, { placeholder, defaultValue, validate } = {}) {
  const result = await text({
    message,
    placeholder,
    initialValue: defaultValue,
    validate: validate ? (value) => validate(String(value ?? "")) : undefined,
  });
  if (isCancel(result)) return null;
  return String(result ?? "").trim();
}

function buildForwardTargets(selectedTargets, toValues) {
  return selectedTargets.map((target) => ({
    channel: target.channel,
    ...(toValues.accountIds?.[target.id] || target.accountId
      ? { accountId: toValues.accountIds?.[target.id] || target.accountId }
      : {}),
    to: toValues[target.id],
  }));
}

function formatDraftHint(target, draftValues, draftAccountIds) {
  const to = draftValues[target.id];
  const accountId = draftAccountIds[target.id] || target.accountId;
  if (!to && !accountId) return "";
  if (target.channel === "openclaw-weixin") {
    return [accountId ? `accountId=${accountId}` : "", to ? `to=${to}` : ""].filter(Boolean).join(" ");
  }
  return to;
}

function isForwardTargetDraftValid(target, draftValues, draftAccountIds, config) {
  const to = draftValues[target.id];
  if (!to) return false;
  if (target.channel === "feishu") return isValidFeishuTo(to, getExistingFeishuAllowFrom(config));
  if (target.channel === "openclaw-weixin") return Boolean(draftAccountIds[target.id] || target.accountId);
  return true;
}

function buildForwardSelectionOptions(targets, validTargetIds, draftValues, draftAccountIds, doneValue) {
  return targets.map((target) => {
    const currentValue = formatDraftHint(target, draftValues, draftAccountIds);
    const configured = validTargetIds.includes(target.id);
    return {
      value: target.id,
      label: `${configured ? "◼" : "◻"} ${target.label}`,
      hint: configured
        ? t("configuredHint", { value: currentValue })
        : currentValue
          ? t("invalidHint", { value: currentValue })
          : t("emptyHint"),
    };
  }).concat({
    value: doneValue,
    label: t("doneLabel"),
    hint: t("doneHint", { count: validTargetIds.length }),
  });
}

async function noteForwardListControls() {
  await note(t("listControls"), t("listControlsTitle"));
}

async function promptTargetAction(target, configured) {
  await note(
    configured
      ? t("pageControlsConfigured")
      : t("pageControlsUnconfigured"),
    t("pageControlsTitle"),
  );

  if (!configured) return "edit";

  return guardCancel(await select({
    message: t("actionMessage", { label: target.label }),
    options: [
      { value: "edit", label: t("actionEdit"), hint: t("actionEditHint") },
      { value: "clear", label: t("actionClear"), hint: t("actionClearHint") },
      { value: "back", label: t("actionBack"), hint: t("actionBackHint") },
    ],
    initialValue: "edit",
  }));
}

async function configureFeishuTarget(target, config, draftValues) {
  const existingAllowFrom = getExistingFeishuAllowFrom(config);
  if (existingAllowFrom.length > 0) {
    await note(t("allowFromDetected", { values: existingAllowFrom.join(", ") }), t("allowFromTitle"));
  }

  const value = await promptTextOrBack(t("feishuToMessage"), {
    placeholder: "ou_xxx",
    defaultValue: draftValues[target.id] || undefined,
    validate: (input) =>
      isValidFeishuTo(input, existingAllowFrom) ? undefined : t("invalidAllowFrom"),
  });

  if (value === null) return null;
  return value;
}

async function configureWeixinTarget(target, draftValues, draftAccountIds) {
  const accountIds = getWeixinAccountIds();
  if (accountIds.length > 0) {
    await note(t("weixinAccountsDetected", { values: accountIds.join(", ") }), t("weixinAccountsTitle"));
  }

  const accountId = await promptTextOrBack(t("weixinAccountIdMessage"), {
    placeholder: accountIds[0] || "weixin-account-id",
    defaultValue: draftAccountIds[target.id] || accountIds[0] || undefined,
    validate: (input) => (String(input ?? "").trim() ? undefined : t("requiredField")),
  });
  if (accountId === null) return null;

  const userIds = getWeixinContextUserIds(accountId);
  if (userIds.length > 0) {
    await note(t("weixinUsersDetected", { values: userIds.join(", ") }), t("weixinUsersTitle"));
  }

  const to = await promptTextOrBack(t("weixinToMessage"), {
    placeholder: userIds[0] || "weixin_user_id",
    defaultValue: draftValues[target.id] || userIds[0] || undefined,
    validate: (input) => (String(input ?? "").trim() ? undefined : t("requiredField")),
  });
  if (to === null) return null;

  return { accountId, to };
}

function buildInitialDraftValues(config, availableTargets) {
  const currentTargets = Array.isArray(config?.channels?.[CHANNEL_ID]?.forwardTo)
    ? [...config.channels[CHANNEL_ID].forwardTo]
    : [];
  const usedIndexes = new Set();

  return Object.fromEntries(
    availableTargets.map((target, index) => {
      const matchedIndex = currentTargets.findIndex((entry, entryIndex) => {
        if (usedIndexes.has(entryIndex)) return false;
        return entry?.channel === target.channel;
      });
      const matched = matchedIndex >= 0 ? currentTargets[matchedIndex] : null;
      if (matchedIndex >= 0) usedIndexes.add(matchedIndex);
      return [
        target.id,
        matched?.to || "",
      ];
    }),
  );
}

function buildInitialDraftAccountIds(config, availableTargets) {
  const currentTargets = Array.isArray(config?.channels?.[CHANNEL_ID]?.forwardTo)
    ? [...config.channels[CHANNEL_ID].forwardTo]
    : [];
  const usedIndexes = new Set();

  return Object.fromEntries(
    availableTargets.map((target) => {
      const matchedIndex = currentTargets.findIndex((entry, entryIndex) => {
        if (usedIndexes.has(entryIndex)) return false;
        return entry?.channel === target.channel;
      });
      const matched = matchedIndex >= 0 ? currentTargets[matchedIndex] : null;
      if (matchedIndex >= 0) usedIndexes.add(matchedIndex);
      return [
        target.id,
        matched?.accountId || target.accountId || "",
      ];
    }),
  );
}

async function configureForwardTargets(config, availableTargets) {
  const draftValues = buildInitialDraftValues(config, availableTargets);
  const draftAccountIds = buildInitialDraftAccountIds(config, availableTargets);
  let validTargetIds = availableTargets
    .filter((target) => isForwardTargetDraftValid(target, draftValues, draftAccountIds, config))
    .map((target) => target.id);
  const doneValue = "__done__";

  while (true) {
    await noteForwardListControls();
    const choice = guardCancel(await select({
      message: t("forwardTargetMessage"),
      options: buildForwardSelectionOptions(availableTargets, validTargetIds, draftValues, draftAccountIds, doneValue),
      initialValue: validTargetIds[0] || availableTargets[0]?.id || doneValue,
    }));

    if (choice === doneValue) {
      draftValues.accountIds = draftAccountIds;
      return buildForwardTargets(availableTargets.filter((target) => validTargetIds.includes(target.id)), draftValues);
    }

    const target = availableTargets.find((item) => item.id === choice);
    if (!target) continue;
    const configured = validTargetIds.includes(target.id);
    const action = await promptTargetAction(target, configured);
    if (action === "back") continue;
    if (action === "clear") {
      draftValues[target.id] = "";
      draftAccountIds[target.id] = target.accountId || "";
      validTargetIds = validTargetIds.filter((id) => id !== target.id);
      continue;
    }

    if (target.channel === "feishu") {
      const value = await configureFeishuTarget(target, config, draftValues);
      if (value === null) continue;
      draftValues[target.id] = value;
      if (isValidFeishuTo(value, getExistingFeishuAllowFrom(config))) {
        validTargetIds = [...validTargetIds, target.id].filter((value, index, array) => array.indexOf(value) === index);
      } else {
        validTargetIds = validTargetIds.filter((id) => id !== target.id);
      }
      continue;
    }

    if (target.channel === "openclaw-weixin") {
      const value = await configureWeixinTarget(target, draftValues, draftAccountIds);
      if (value === null) continue;
      draftValues[target.id] = value.to;
      draftAccountIds[target.id] = value.accountId;
      if (isForwardTargetDraftValid(target, draftValues, draftAccountIds, config)) {
        validTargetIds = [...validTargetIds, target.id].filter((value, index, array) => array.indexOf(value) === index);
      } else {
        validTargetIds = validTargetIds.filter((id) => id !== target.id);
      }
      continue;
    }

    validTargetIds = [...validTargetIds, target.id].filter((value, index, array) => array.indexOf(value) === index);
  }
}

function mergeLookiChannelConfig(config, channelConfig) {
  return {
    ...config,
    channels: {
      ...config.channels,
      [CHANNEL_ID]: {
        ...config.channels?.[CHANNEL_ID],
        ...channelConfig,
      },
    },
  };
}

function installPlugin() {
  const progress = spinner();
  progress.start(t("installStart"));
  try {
    const installOut = run(`openclaw plugins install "${PLUGIN_SPEC}"`);
    progress.stop(t("installDone"));
    if (installOut) log(installOut);
  } catch (installErr) {
    if (installErr.stderr && installErr.stderr.includes("already exists")) {
      progress.stop(t("installUpdate"));
      try {
        const updateOut = run(`openclaw plugins update "${CHANNEL_ID}"`);
        log(t("installUpdated"));
        if (updateOut) log(updateOut);
      } catch (updateErr) {
        error(t("updateFailedManual"));
        if (updateErr.stderr) console.error(updateErr.stderr);
        console.log(`  openclaw plugins update "${CHANNEL_ID}"`);
        process.exit(1);
      }
      return;
    }

    progress.stop(t("installFailed"));
    error(t("installFailedManual"));
    if (installErr.stderr) console.error(installErr.stderr);
    console.log(`  openclaw plugins install "${PLUGIN_SPEC}"`);
    process.exit(1);
  }
}

function restartGateway() {
  const progress = spinner();
  progress.start(t("restartStart"));
  try {
    run("openclaw gateway restart", { silent: false });
    progress.stop(t("restartDone"));
  } catch {
    progress.stop(t("restartFailed"));
    error(t("restartFailedManual"));
    console.log("  openclaw gateway restart");
  }
}

function ensureWeixinForwardingVersion(openclawVersion, forwardTo) {
  const hasWeixinForwarding = forwardTo.some((target) => target.channel === "openclaw-weixin");
  if (!hasWeixinForwarding) return;
  if (compareVersions(openclawVersion, MIN_WEIXIN_OUTBOUND_VERSION) >= 0) return;
  error(t("weixinVersionTooLow", { version: openclawVersion }));
  process.exit(1);
}

async function configureLooki(openclawVersion) {
  const config = readConfig();
  currentLocale = guardCancel(await select({
    message: "选择界面语言 / Choose interface language",
    options: UI_LANGUAGE_OPTIONS,
    initialValue: DEFAULT_LOCALE,
  }));

  const baseUrlOptions = getBaseUrlOptions();
  const currentBaseUrl = normalizeBaseUrl(config?.channels?.[CHANNEL_ID]?.baseUrl);
  const currentApiKey = String(config?.channels?.[CHANNEL_ID]?.apiKey ?? "").trim();
  const initialBaseUrl =
    baseUrlOptions.find((option) => option.value === currentBaseUrl)?.value ?? baseUrlOptions[0].value;

  intro(t("intro"));

  await note(t("envNote"), t("envTitle"));
  const baseUrl = await promptSelect(t("envMessage"), baseUrlOptions, initialBaseUrl);

  await note(t("apiKeyNote"), t("apiKeyTitle"));
  const apiKey = await promptText(t("apiKeyMessage"), {
    placeholder: "lk-...",
    defaultValue: currentApiKey || undefined,
  });

  const availableTargets = detectForwardTargets(config);
  let forwardTo = [];

  if (availableTargets.length === 0) {
    await note(t("pluginNone"), t("pluginTitle"));
  } else {
    await note(
      t("pluginDetected", { labels: availableTargets.map((target) => target.label).join("、") }),
      t("pluginTitle"),
    );
    forwardTo = await configureForwardTargets(config, availableTargets);
  }
  ensureWeixinForwardingVersion(openclawVersion, forwardTo);

  const nextConfig = mergeLookiChannelConfig(config, {
    enabled: true,
    baseUrl,
    apiKey,
    accountId: "default",
    forwardTo,
  });

  writeConfig(nextConfig);
  await note(t("configWritten", { path: getConfigPath() }), t("configWrittenTitle"));
}

async function install() {
  ensureOpenclawInstalled();
  const openclawVersion = ensureHostVersion();
  installPlugin();
  await configureLooki(openclawVersion);
  restartGateway();
  outro(t("outro"));
}

function help() {
  console.log(`
${t("helpUsage")}

${t("helpCommands")}
${t("helpInstall")}
${t("helpHelp")}
`);
}

const command = process.argv[2];

switch (command) {
  case "install":
    await install();
    break;
  case "help":
  case "--help":
  case "-h":
    help();
    break;
  default:
    if (command) {
      error(t("unknownCommand", { command }));
    }
    help();
    process.exit(command ? 1 : 0);
}
