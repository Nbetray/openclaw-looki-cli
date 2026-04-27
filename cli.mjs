#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const MIN_OPENCLAW_VERSION = "2026.4.24";
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
    detectIds: ["feishu", "openclaw-lark", "@larksuite/openclaw-lark"],
    label: "飞书 / Lark",
    channel: "feishu",
    accountId: "default",
    hint: "把 Looki 的 Agent 输出转发到飞书 / Lark",
  },
  {
    id: "openclaw-weixin",
    detectIds: ["openclaw-weixin"],
    label: "微信 / WeChat",
    channel: "openclaw-weixin",
    hint: "把 Looki 的 Agent 输出转发到微信 / WeChat",
  },
  {
    id: "qqbot",
    detectIds: ["qqbot"],
    label: "QQ Bot",
    channel: "qqbot",
    hint: "把 Looki 的 Agent 输出转发到 QQ Bot",
  },
  {
    id: "line",
    detectIds: ["line"],
    label: "LINE",
    channel: "line",
    hint: "把 Looki 的 Agent 输出转发到 LINE",
  },
  {
    id: "whatsapp",
    detectIds: ["whatsapp"],
    label: "WhatsApp",
    channel: "whatsapp",
    hint: "把 Looki 的 Agent 输出转发到 WhatsApp",
  },
  {
    id: "telegram",
    detectIds: ["telegram"],
    label: "Telegram",
    channel: "telegram",
    hint: "把 Looki 的 Agent 输出转发到 Telegram",
  },
  {
    id: "discord",
    detectIds: ["discord"],
    label: "Discord",
    channel: "discord",
    hint: "把 Looki 的 Agent 输出转发到 Discord",
  },
];

let currentLocale = DEFAULT_LOCALE;

const MESSAGES = loadLocaleMessages();
const GLOBAL_MESSAGE_PARAMS = {
  pluginSpec: PLUGIN_SPEC,
  minOpenclawVersion: MIN_OPENCLAW_VERSION,
};

function readLocaleMessages(locale) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(currentDir, "i18n", `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadLocaleMessages() {
  return {
    "zh-CN": readLocaleMessages("zh-CN"),
    en: readLocaleMessages("en"),
  };
}

function selectMessageTemplate(value, params) {
  if (typeof value === "string") return value;
  const count = Number(params.count ?? 0);
  if (count === 0 && value.zero) return value.zero;
  if (count === 1 && value.one) return value.one;
  return value.other;
}

function interpolate(template, params) {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) =>
    params[key] === undefined ? match : String(params[key]),
  );
}

function t(key, params = {}) {
  const mergedParams = { ...GLOBAL_MESSAGE_PARAMS, ...params };
  const value = MESSAGES[currentLocale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  return interpolate(selectMessageTemplate(value, mergedParams), mergedParams);
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
  const feishu = config?.channels?.feishu;
  const values = [
    ...(Array.isArray(feishu?.allowFrom) ? feishu.allowFrom : []),
    ...Object.values(feishu?.accounts ?? {}).flatMap((account) =>
      Array.isArray(account?.allowFrom) ? account.allowFrom : [],
    ),
  ];
  return [...new Set(values.map((entry) => String(entry).trim()).filter((entry) => entry && entry !== "*"))];
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

async function configureGenericTarget(target, draftValues, draftAccountIds) {
  const accountId = await promptTextOrBack(t("genericAccountIdMessage", { label: target.label }), {
    placeholder: `${target.channel}-account-id`,
    defaultValue: draftAccountIds[target.id] || target.accountId || undefined,
  });
  if (accountId === null) return null;

  const to = await promptTextOrBack(t("genericToMessage", { label: target.label }), {
    placeholder: `${target.channel}-target-id`,
    defaultValue: draftValues[target.id] || undefined,
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

    const value = await configureGenericTarget(target, draftValues, draftAccountIds);
    if (value === null) continue;
    draftValues[target.id] = value.to;
    draftAccountIds[target.id] = value.accountId;
    if (isForwardTargetDraftValid(target, draftValues, draftAccountIds, config)) {
      validTargetIds = [...validTargetIds, target.id].filter((value, index, array) => array.indexOf(value) === index);
    } else {
      validTargetIds = validTargetIds.filter((id) => id !== target.id);
    }
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
