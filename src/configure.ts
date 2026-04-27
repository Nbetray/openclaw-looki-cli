import { note, select, text } from "@clack/prompts";

import {
  CHANNEL_ID,
  CHINA_BASE_URL,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_LOCALE,
  GLOBAL_BASE_URL,
  UI_LANGUAGE_OPTIONS,
  patchLookiChannelConfig,
  type Locale,
} from "@nbetray/openclaw-looki/shared";

import { runForwardWizard } from "./forward-wizard.js";
import { log, makeGuardCancel } from "./ui.js";
import {
  ConfigReadError,
  getConfigPath,
  readConfig,
  readSavedLocale,
  withSavedLocale,
  writeConfig,
  type OpenclawConfig,
} from "./config-io.js";
import { MESSAGES, type Translator } from "./i18n.js";

export type ConfigureOverrides = {
  baseUrl?: string;
  apiKey?: string;
  locale?: Locale;
};

export type ConfigureResult = {
  config: OpenclawConfig;
  locale: Locale;
};

function normalizeBaseUrl(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "A") return GLOBAL_BASE_URL;
  if (trimmed === "B") return CHINA_BASE_URL;
  return trimmed;
}

function getBaseUrlOptions(t: Translator) {
  return [
    { label: t("envOptionGlobal"), value: GLOBAL_BASE_URL, hint: t("envHintGlobal") },
    { label: t("envOptionChina"), value: CHINA_BASE_URL, hint: t("envHintChina") },
  ];
}

export function pickInitialLocale(overrides: ConfigureOverrides, saved: Locale | null): Locale {
  if (overrides.locale) return overrides.locale;
  if (saved) return saved;
  return DEFAULT_LOCALE;
}

export async function chooseLocale(
  initialLocale: Locale,
  overridden: boolean,
  t: Translator,
  setLocale: (next: Locale) => void,
): Promise<Locale> {
  if (overridden) {
    setLocale(initialLocale);
    return initialLocale;
  }
  // Use a neutral message key — we haven't committed to a locale yet.
  const guardCancel = makeGuardCancel(t);
  const neutralMessage = `${MESSAGES["zh-CN"].languageMessageCli} / ${MESSAGES.en.languageMessageCli}`;
  const next = guardCancel(
    await select<Locale>({
      message: neutralMessage,
      options: [...UI_LANGUAGE_OPTIONS],
      initialValue: initialLocale,
    }),
  );
  setLocale(next);
  return next;
}

function resolveInitialConfig(t: Translator): OpenclawConfig {
  try {
    return readConfig();
  } catch (err) {
    if (err instanceof ConfigReadError) {
      log(t("diagnoseConfigReadFail", { path: err.path }));
      throw err;
    }
    throw err;
  }
}

export async function runConfigure(
  t: Translator,
  setLocale: (next: Locale) => void,
  overrides: ConfigureOverrides = {},
): Promise<ConfigureResult> {
  const existing = resolveInitialConfig(t);
  const savedLocale = readSavedLocale(existing);
  const initialLocale = pickInitialLocale(overrides, savedLocale);
  // Skip the language prompt when the user already picked one last time,
  // or forced one via --locale.
  const alreadyDecided = overrides.locale != null || savedLocale != null;
  const locale = await chooseLocale(initialLocale, alreadyDecided, t, setLocale);

  let baseUrl = overrides.baseUrl ?? "";
  if (!baseUrl) {
    const guardCancel = makeGuardCancel(t);
    const baseUrlOptions = getBaseUrlOptions(t);
    const currentBaseUrl = normalizeBaseUrl(
      (existing.channels?.[CHANNEL_ID] as { baseUrl?: unknown } | undefined)?.baseUrl,
    );
    const initialBaseUrl =
      baseUrlOptions.find((option) => option.value === currentBaseUrl)?.value ??
      baseUrlOptions[0].value;

    await note(t("envNote"), t("envTitle"));
    baseUrl = guardCancel(
      await select<string>({
        message: t("envMessage"),
        options: baseUrlOptions,
        initialValue: initialBaseUrl,
      }),
    );
  }

  let apiKey = overrides.apiKey ?? "";
  if (!apiKey) {
    const guardCancel = makeGuardCancel(t);
    const currentApiKey = String(
      (existing.channels?.[CHANNEL_ID] as { apiKey?: unknown } | undefined)?.apiKey ?? "",
    ).trim();
    await note(t("apiKeyNote"), t("apiKeyTitle"));
    const raw = guardCancel(
      await text({
        message: t("apiKeyMessage"),
        placeholder: "lk-...",
        initialValue: currentApiKey || undefined,
        validate: (value) => {
          const trimmed = String(value ?? "").trim();
          if (!trimmed && !currentApiKey) return t("requiredField");
          return undefined;
        },
      }),
    );
    apiKey = (String(raw || "") || currentApiKey).trim();
  }

  const forwardTo = await runForwardWizard(t, existing);

  let nextConfig = patchLookiChannelConfig(existing, {
    enabled: true,
    baseUrl,
    apiKey,
    accountId: DEFAULT_ACCOUNT_ID,
    forwardTo,
  });
  nextConfig = withSavedLocale(nextConfig, locale);

  writeConfig(nextConfig);
  await note(t("configWritten", { path: getConfigPath() }), t("configWrittenTitle"));
  log(t("languageSaved", { locale }));

  return { config: nextConfig, locale };
}
