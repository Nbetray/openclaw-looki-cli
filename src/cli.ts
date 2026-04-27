#!/usr/bin/env node
import { intro, outro, spinner } from "@clack/prompts";

import {
  DEFAULT_LOCALE,
  MIN_OPENCLAW_VERSION,
  PLUGIN_SPEC,
  type Locale,
} from "@nbetray/openclaw-looki/shared";

import { CliArgsError, parseCliArgs, type CliOptions } from "./args.js";
import { runConfigure } from "./configure.js";
import { makeTranslator, type Translator } from "./i18n.js";
import { error } from "./ui.js";
import {
  ensureHostVersion,
  ensureOpenclawInstalled,
  installPlugin,
  restartGateway,
} from "./openclaw-cli.js";

let currentLocale: Locale = DEFAULT_LOCALE;

function setLocale(next: Locale): void {
  currentLocale = next;
}

const t: Translator = makeTranslator(() => currentLocale, {
  pluginSpec: PLUGIN_SPEC,
  minOpenclawVersion: MIN_OPENCLAW_VERSION,
});

function initLocale(options: CliOptions): void {
  if (options.locale) {
    setLocale(options.locale);
    return;
  }
}

function printHelp(): void {
  console.log(`
${t("helpUsage")}

${t("helpCommands")}
${t("helpInstall")}
${t("helpConfigure")}
${t("helpHelp")}

${t("helpOptionsTitle")}
${t("helpOptionBaseUrl")}
${t("helpOptionApiKey")}
${t("helpOptionLocale")}
${t("helpOptionNoRestart")}
`);
}

async function runInstall(options: CliOptions): Promise<void> {
  intro(t("intro"));
  ensureOpenclawInstalled(t);
  ensureHostVersion(t);

  const progress = spinner();
  progress.start(t("installStart"));
  installPlugin(t, {
    onProgress: (stage) => {
      if (stage === "install-done") progress.stop(t("installDone"));
      else if (stage === "update-start") progress.stop(t("installUpdate"));
    },
  });

  await runConfigure(t, setLocale, {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    locale: options.locale,
  });

  if (options.restart) {
    const restartProgress = spinner();
    restartProgress.start(t("restartStart"));
    restartGateway(t);
    restartProgress.stop(t("restartDone"));
  }
  outro(t("outro"));
}

async function runConfigureCommand(options: CliOptions): Promise<void> {
  intro(t("intro"));
  await runConfigure(t, setLocale, {
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    locale: options.locale,
  });
  if (options.restart) {
    const restartProgress = spinner();
    restartProgress.start(t("restartStart"));
    restartGateway(t);
    restartProgress.stop(t("restartDone"));
  }
  outro(t("outro"));
}

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof CliArgsError) {
      const hintKey = err.keyHint;
      if (hintKey === "invalidFlagLocale") {
        error(t(hintKey, { values: "zh-CN, en" }));
      } else if (hintKey === "flagParseError" || !hintKey) {
        error(t("flagParseError", { message: err.message }));
      } else {
        error(t(hintKey));
      }
      return 1;
    }
    throw err;
  }

  if (parsed.locale) setLocale(parsed.locale);

  if (parsed.kind === "help") {
    if (parsed.unknown) {
      error(t("unknownCommand", { command: parsed.unknown }));
      printHelp();
      return 1;
    }
    printHelp();
    return 0;
  }

  initLocale(parsed);

  if (parsed.command === "install") {
    await runInstall(parsed);
    return 0;
  }
  if (parsed.command === "configure") {
    await runConfigureCommand(parsed);
    return 0;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    error(String(err instanceof Error ? err.message : err));
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  },
);
