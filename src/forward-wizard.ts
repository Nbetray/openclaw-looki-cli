import { isCancel, note, select, text } from "@clack/prompts";

import {
  defaultForwardAccountId,
  detectForwardTargets,
  getExistingFeishuAllowFrom,
  getQQBotKnownTargets,
  getWeixinAccountIds,
  getWeixinContextUserIds,
  isValidFeishuTo,
  type SupportedForwardPlugin,
} from "@nbetray/openclaw-looki/shared";

import type { OpenclawConfig } from "./config-io.js";
import type { Translator } from "./i18n.js";
import { makeGuardCancel } from "./ui.js";

const CHANNEL_ID = "openclaw-looki";

type DraftMap = Record<string, string>;

type ForwardTarget = {
  channel: string;
  accountId?: string;
  to: string;
};

async function promptTextOrBack(
  message: string,
  opts: {
    placeholder?: string;
    defaultValue?: string;
    validate?: (input: string) => string | undefined;
  } = {},
): Promise<string | null> {
  const result = await text({
    message,
    placeholder: opts.placeholder,
    initialValue: opts.defaultValue,
    validate: opts.validate ? (value) => opts.validate!(String(value ?? "")) : undefined,
  });
  if (isCancel(result)) return null;
  return String(result ?? "").trim();
}

export async function runForwardWizard(
  t: Translator,
  config: OpenclawConfig,
): Promise<ForwardTarget[]> {
  const guardCancel = makeGuardCancel(t);
  const availableTargets = detectForwardTargets(config);
  if (availableTargets.length === 0) {
    await note(t("pluginNone"), t("pluginTitle"));
    return [];
  }

  await note(
    t("pluginDetected", { labels: availableTargets.map((target) => target.label).join("、") }),
    t("pluginTitle"),
  );

  const draftValues = buildInitialDraftValues(config, availableTargets);
  const draftAccountIds = buildInitialDraftAccountIds(config, availableTargets);
  let validTargetIds = availableTargets
    .filter((target) => isForwardTargetDraftValid(target, draftValues, draftAccountIds, config))
    .map((target) => target.id);

  const doneValue = "__done__";

  while (true) {
    await note(t("listControls"), t("listControlsTitle"));
    const choice = guardCancel(
      await select({
        message: t("forwardTargetMessage"),
        options: buildSelectionOptions(
          t,
          availableTargets,
          validTargetIds,
          draftValues,
          draftAccountIds,
          doneValue,
        ),
        initialValue: validTargetIds[0] || availableTargets[0]?.id || doneValue,
      }),
    );

    if (choice === doneValue) {
      return buildForwardTargets(
        availableTargets.filter((target) => validTargetIds.includes(target.id)),
        draftValues,
        draftAccountIds,
      );
    }

    const target = availableTargets.find((item) => item.id === choice);
    if (!target) continue;
    const configured = validTargetIds.includes(target.id);

    const action = await promptTargetAction(t, target, configured);
    if (action === "back") continue;
    if (action === "clear") {
      draftValues[target.id] = "";
      draftAccountIds[target.id] = defaultForwardAccountId(target) || "";
      validTargetIds = validTargetIds.filter((id) => id !== target.id);
      continue;
    }

    if (target.channel === "feishu") {
      const value = await configureFeishuTarget(t, target, config, draftValues);
      if (value === null) continue;
      draftValues[target.id] = value;
    } else if (target.channel === "openclaw-weixin") {
      const value = await configureWeixinTarget(t, target, draftValues, draftAccountIds);
      if (value === null) continue;
      draftValues[target.id] = value.to;
      draftAccountIds[target.id] = value.accountId;
    } else if (target.channel === "qqbot") {
      const value = await configureQQBotTarget(t, target, draftValues, draftAccountIds);
      if (value === null) continue;
      draftValues[target.id] = value.to;
      draftAccountIds[target.id] = value.accountId;
    } else {
      const value = await configureGenericTarget(t, target, draftValues, draftAccountIds);
      if (value === null) continue;
      draftValues[target.id] = value.to;
      draftAccountIds[target.id] = value.accountId;
    }

    if (isForwardTargetDraftValid(target, draftValues, draftAccountIds, config)) {
      validTargetIds = [...validTargetIds, target.id].filter((v, i, a) => a.indexOf(v) === i);
    } else {
      validTargetIds = validTargetIds.filter((id) => id !== target.id);
    }
  }
}

function buildInitialDraftValues(
  config: OpenclawConfig,
  availableTargets: readonly SupportedForwardPlugin[],
): DraftMap {
  const channelSection = config.channels?.[CHANNEL_ID] as { forwardTo?: unknown } | undefined;
  const currentTargets = Array.isArray(channelSection?.forwardTo)
    ? [...(channelSection!.forwardTo as Array<{ channel?: string; to?: string }>)]
    : [];
  const usedIndexes = new Set<number>();

  return Object.fromEntries(
    availableTargets.map((target) => {
      const matchedIndex = currentTargets.findIndex((entry, entryIndex) => {
        if (usedIndexes.has(entryIndex)) return false;
        return entry?.channel === target.channel;
      });
      const matched = matchedIndex >= 0 ? currentTargets[matchedIndex] : null;
      if (matchedIndex >= 0) usedIndexes.add(matchedIndex);
      return [target.id, matched?.to || ""];
    }),
  );
}

function buildInitialDraftAccountIds(
  config: OpenclawConfig,
  availableTargets: readonly SupportedForwardPlugin[],
): DraftMap {
  const channelSection = config.channels?.[CHANNEL_ID] as { forwardTo?: unknown } | undefined;
  const currentTargets = Array.isArray(channelSection?.forwardTo)
    ? [...(channelSection!.forwardTo as Array<{ channel?: string; accountId?: string }>)]
    : [];
  const usedIndexes = new Set<number>();

  return Object.fromEntries(
    availableTargets.map((target) => {
      const matchedIndex = currentTargets.findIndex((entry, entryIndex) => {
        if (usedIndexes.has(entryIndex)) return false;
        return entry?.channel === target.channel;
      });
      const matched = matchedIndex >= 0 ? currentTargets[matchedIndex] : null;
      if (matchedIndex >= 0) usedIndexes.add(matchedIndex);
      return [target.id, matched?.accountId || defaultForwardAccountId(target) || ""];
    }),
  );
}

function isForwardTargetDraftValid(
  target: SupportedForwardPlugin,
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
  config: OpenclawConfig,
): boolean {
  const to = draftValues[target.id];
  if (!to) return false;
  if (target.channel === "feishu") {
    return isValidFeishuTo(to, getExistingFeishuAllowFrom(config));
  }
  if (target.channel === "openclaw-weixin") {
    return Boolean(draftAccountIds[target.id] || defaultForwardAccountId(target));
  }
  return true;
}

function formatDraftHint(
  target: SupportedForwardPlugin,
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
): string {
  const to = draftValues[target.id];
  const accountId = draftAccountIds[target.id] || defaultForwardAccountId(target);
  if (!to && !accountId) return "";
  if (target.channel === "openclaw-weixin" || target.channel === "qqbot") {
    return [accountId ? `accountId=${accountId}` : "", to ? `to=${to}` : ""]
      .filter(Boolean)
      .join(" ");
  }
  return to;
}

function buildSelectionOptions(
  t: Translator,
  targets: readonly SupportedForwardPlugin[],
  validTargetIds: string[],
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
  doneValue: string,
): Array<{ value: string; label: string; hint?: string }> {
  const options = targets.map((target) => {
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
  });
  options.push({
    value: doneValue,
    label: t("doneLabel"),
    hint: t("doneHint", { count: validTargetIds.length }),
  });
  return options;
}

function buildForwardTargets(
  selectedTargets: readonly SupportedForwardPlugin[],
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
): ForwardTarget[] {
  return selectedTargets.map((target) => {
    const accountId = draftAccountIds[target.id] || defaultForwardAccountId(target);
    return {
      channel: target.channel,
      ...(accountId ? { accountId } : {}),
      to: draftValues[target.id],
    };
  });
}

async function promptTargetAction(
  t: Translator,
  target: SupportedForwardPlugin,
  configured: boolean,
): Promise<"edit" | "clear" | "back"> {
  const guardCancel = makeGuardCancel(t);
  await note(
    configured ? t("pageControlsConfigured") : t("pageControlsUnconfigured"),
    t("pageControlsTitle"),
  );

  if (!configured) return "edit";

  return guardCancel(
    await select<"edit" | "clear" | "back">({
      message: t("actionMessage", { label: target.label }),
      options: [
        { value: "edit", label: t("actionEdit"), hint: t("actionEditHint") },
        { value: "clear", label: t("actionClear"), hint: t("actionClearHint") },
        { value: "back", label: t("actionBack"), hint: t("actionBackHint") },
      ],
      initialValue: "edit",
    }),
  );
}

async function configureFeishuTarget(
  t: Translator,
  target: SupportedForwardPlugin,
  config: OpenclawConfig,
  draftValues: DraftMap,
): Promise<string | null> {
  const existingAllowFrom = getExistingFeishuAllowFrom(config);
  if (existingAllowFrom.length > 0) {
    await note(
      t("allowFromDetected", { values: existingAllowFrom.join(", ") }),
      t("allowFromTitle"),
    );
  }

  return promptTextOrBack(t("feishuToMessage"), {
    placeholder: target.placeholder || "ou_xxx",
    defaultValue: draftValues[target.id] || undefined,
    validate: (input) =>
      isValidFeishuTo(input, existingAllowFrom) ? undefined : t("invalidAllowFrom"),
  });
}

async function configureWeixinTarget(
  t: Translator,
  target: SupportedForwardPlugin,
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
): Promise<{ accountId: string; to: string } | null> {
  await note(t("weixinTargetHelp"), t("weixinTargetHelpTitle"));

  const accountIds = getWeixinAccountIds();
  if (accountIds.length > 0) {
    await note(
      t("weixinAccountsDetected", { values: accountIds.join(", ") }),
      t("weixinAccountsTitle"),
    );
  }

  const accountId = await promptTextOrBack(t("weixinAccountIdMessage"), {
    placeholder: accountIds[0] || "weixin-account-id",
    defaultValue: draftAccountIds[target.id] || accountIds[0] || undefined,
    validate: (input) => (input.trim() ? undefined : t("requiredField")),
  });
  if (accountId === null) return null;

  const userIds = getWeixinContextUserIds(accountId);
  if (userIds.length > 0) {
    await note(t("weixinUsersDetected", { values: userIds.join(", ") }), t("weixinUsersTitle"));
  }

  const to = await promptTextOrBack(t("weixinToMessage"), {
    placeholder: userIds[0] || target.placeholder || "weixin_user_id",
    defaultValue: draftValues[target.id] || userIds[0] || undefined,
    validate: (input) => (input.trim() ? undefined : t("requiredField")),
  });
  if (to === null) return null;

  return { accountId, to };
}

async function configureQQBotTarget(
  t: Translator,
  target: SupportedForwardPlugin,
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
): Promise<{ accountId: string; to: string } | null> {
  await note(t("qqbotTargetHelp"), t("qqbotTargetHelpTitle"));

  const knownTargets = getQQBotKnownTargets();
  const accountIds = [...new Set(knownTargets.map((entry) => entry.accountId).filter(Boolean))];
  const defaultAccountId =
    draftAccountIds[target.id] || accountIds[0] || defaultForwardAccountId(target) || undefined;

  if (knownTargets.length > 0) {
    await note(
      t("qqbotTargetsDetected", {
        values: knownTargets
          .map((entry) =>
            [entry.accountId ? `accountId=${entry.accountId}` : "", `to=${entry.to}`]
              .filter(Boolean)
              .join(" "),
          )
          .join(", "),
      }),
      t("qqbotTargetsTitle"),
    );
  }

  const accountId = await promptTextOrBack(t("qqbotAccountIdMessage"), {
    placeholder: defaultAccountId || "default",
    defaultValue: defaultAccountId,
  });
  if (accountId === null) return null;

  const matchedTargets = knownTargets.filter(
    (entry) => !accountId || entry.accountId === accountId,
  );
  const defaultTo =
    draftValues[target.id] || matchedTargets[0]?.to || knownTargets[0]?.to || undefined;
  const to = await promptTextOrBack(t("qqbotToMessage"), {
    placeholder: defaultTo || target.placeholder || "qqbot:c2c:<user_openid>",
    defaultValue: defaultTo,
    validate: (input) => (input.trim() ? undefined : t("requiredField")),
  });
  if (to === null) return null;

  return { accountId, to };
}

async function configureGenericTarget(
  t: Translator,
  target: SupportedForwardPlugin,
  draftValues: DraftMap,
  draftAccountIds: DraftMap,
): Promise<{ accountId: string; to: string } | null> {
  const accountId = await promptTextOrBack(t("genericAccountIdMessage", { label: target.label }), {
    placeholder: defaultForwardAccountId(target) || "default",
    defaultValue: draftAccountIds[target.id] || defaultForwardAccountId(target) || undefined,
  });
  if (accountId === null) return null;

  const to = await promptTextOrBack(t("genericToMessage", { label: target.label }), {
    placeholder: target.placeholder || `${target.channel}-target-id`,
    defaultValue: draftValues[target.id] || undefined,
    validate: (input) => (input.trim() ? undefined : t("requiredField")),
  });
  if (to === null) return null;

  return { accountId, to };
}
