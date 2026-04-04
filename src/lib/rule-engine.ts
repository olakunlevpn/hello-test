import type { MicrosoftGraphService } from "./microsoft-graph";
import type { EmailMessage, ComposeEmailPayload } from "../types/mail";
import type { RuleCondition, RuleAction, ConditionLogic } from "../types/rules";

interface RuleRecord {
  id: string;
  name: string;
  conditions: RuleCondition[];
  conditionLogic: ConditionLogic;
  actions: RuleAction[];
  stopProcessing: boolean;
  isActive: boolean;
  priority: number;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface DbClient {
  automationRule: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  activityLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export interface RuleEngineResult {
  rulesMatched: number;
  actionsExecuted: string[];
  emailDeleted: boolean;
}

function evaluateCondition(email: EmailMessage, condition: RuleCondition): boolean {
  const { field, operator, value } = condition;
  const valueLower = value.toLowerCase();

  let target = "";

  switch (field) {
    case "sender":
      target = (email.from?.emailAddress?.address || "").toLowerCase();
      break;
    case "senderDomain": {
      const addr = (email.from?.emailAddress?.address || "").toLowerCase();
      target = addr.includes("@") ? addr.split("@")[1] : "";
      break;
    }
    case "subject":
      target = (email.subject || "").toLowerCase();
      break;
    case "body":
      target = (email.bodyPreview || "").toLowerCase();
      break;
    case "hasAttachments":
      target = email.hasAttachments ? "true" : "false";
      break;
    case "importance":
      target = (email.importance || "normal").toLowerCase();
      break;
    case "recipient": {
      const allRecipients = [
        ...(email.toRecipients || []),
        ...(email.ccRecipients || []),
      ];
      target = allRecipients
        .map((r) => r.emailAddress?.address?.toLowerCase() || "")
        .join(" ");
      break;
    }
    default:
      return false;
  }

  switch (operator) {
    case "contains":
      return target.includes(valueLower);
    case "notContains":
      return !target.includes(valueLower);
    case "equals":
      return target === valueLower;
    case "notEquals":
      return target !== valueLower;
    case "startsWith":
      return target.startsWith(valueLower);
    case "endsWith":
      return target.endsWith(valueLower);
    default:
      return false;
  }
}

function evaluateConditions(
  email: EmailMessage,
  conditions: RuleCondition[],
  logic: ConditionLogic
): boolean {
  if (conditions.length === 0) return false;

  if (logic === "AND") {
    return conditions.every((c) => evaluateCondition(email, c));
  }
  return conditions.some((c) => evaluateCondition(email, c));
}

async function executeAction(
  graphService: MicrosoftGraphService,
  email: EmailMessage,
  action: RuleAction,
  telegram: TelegramConfig | null,
  ruleName: string
): Promise<{ executed: boolean; deleted: boolean }> {
  try {
    switch (action.type) {
      case "forward":
        if (action.value) {
          await graphService.forwardMessage(
            email.id,
            [{ emailAddress: { address: action.value } }],
            `Auto-forwarded by rule: ${ruleName}`
          );
          return { executed: true, deleted: false };
        }
        break;

      case "silentForward":
        if (action.value) {
          await graphService.forwardMessage(
            email.id,
            [{ emailAddress: { address: action.value } }]
          );
          return { executed: true, deleted: false };
        }
        break;

      case "delete":
        await graphService.deleteMessage(email.id);
        return { executed: true, deleted: true };

      case "blockSender":
        await graphService.deleteMessage(email.id);
        return { executed: true, deleted: true };

      case "moveToFolder":
        if (action.value) {
          await graphService.moveMessage(email.id, action.value);
          return { executed: true, deleted: false };
        }
        break;

      case "markAsRead":
        await graphService.markAsRead(email.id, true);
        return { executed: true, deleted: false };

      case "flag":
        await graphService.flagMessage(email.id, "flagged");
        return { executed: true, deleted: false };

      case "setCategory":
        if (action.value) {
          await graphService.setCategories(email.id, [action.value]);
          return { executed: true, deleted: false };
        }
        break;

      case "telegramAlert":
        if (telegram) {
          const senderName =
            email.from?.emailAddress?.name ||
            email.from?.emailAddress?.address ||
            "Unknown";
          const subject = email.subject || "(no subject)";
          const customText = action.value || "";
          const msg = `🔔 <b>Rule: ${ruleName}</b>\nFrom: ${senderName}\nSubject: ${subject}${customText ? `\nNote: ${customText}` : ""}`;

          await fetch(
            `https://api.telegram.org/bot${telegram.botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: telegram.chatId,
                text: msg,
                parse_mode: "HTML",
              }),
            }
          );
          return { executed: true, deleted: false };
        }
        break;

      case "autoReply":
        if (action.value) {
          const senderAddr = (email.from?.emailAddress?.address || "").toLowerCase();
          const isNoReply =
            senderAddr.includes("noreply") ||
            senderAddr.includes("no-reply") ||
            senderAddr.includes("mailer-daemon") ||
            senderAddr.includes("postmaster");

          if (!isNoReply) {
            const payload: ComposeEmailPayload = {
              subject: `Re: ${email.subject || ""}`,
              body: { contentType: "HTML", content: action.value },
              toRecipients: [email.from],
            };
            await graphService.sendMail(payload, false);
            return { executed: true, deleted: false };
          }
        }
        break;
    }
  } catch {
    // Action failed — continue to next action
  }

  return { executed: false, deleted: false };
}

/**
 * Process all active rules for an incoming email.
 * Rules are sorted by priority (lower = first).
 * If a rule has stopProcessing=true and matches, no further rules run.
 */
export async function processRules(
  graphService: MicrosoftGraphService,
  email: EmailMessage,
  rules: RuleRecord[],
  telegram: TelegramConfig | null,
  db?: DbClient,
  linkedAccountId?: string
): Promise<RuleEngineResult> {
  const result: RuleEngineResult = {
    rulesMatched: 0,
    actionsExecuted: [],
    emailDeleted: false,
  };

  const emailFrom = email.from?.emailAddress?.address || "unknown";
  const emailSubject = email.subject || "(no subject)";

  // Sort by priority ascending (0 = highest priority)
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const conditions = (rule.conditions || []) as RuleCondition[];
    const actions = (rule.actions || []) as RuleAction[];
    const logic = (rule.conditionLogic || "AND") as ConditionLogic;

    if (conditions.length === 0) continue;

    const matches = evaluateConditions(email, conditions, logic);
    if (!matches) continue;

    result.rulesMatched++;

    // Update rule analytics
    if (db) {
      try {
        await db.automationRule.update({
          where: { id: rule.id },
          data: { triggerCount: { increment: 1 }, lastTriggeredAt: new Date() },
        });
      } catch { /* non-critical */ }
    }

    for (const action of actions) {
      if (result.emailDeleted) break;

      const actionResult = await executeAction(
        graphService,
        email,
        action,
        telegram,
        rule.name
      );

      if (actionResult.executed) {
        result.actionsExecuted.push(`${rule.name}:${action.type}`);

        // Log activity
        if (db && linkedAccountId) {
          try {
            await db.activityLog.create({
              data: {
                linkedAccountId,
                action: action.type,
                details: action.value || null,
                emailSubject,
                emailFrom,
                ruleName: rule.name,
              },
            });
          } catch { /* non-critical */ }
        }
      }
      if (actionResult.deleted) {
        result.emailDeleted = true;
      }
    }

    if (rule.stopProcessing) break;
    if (result.emailDeleted) break;
  }

  return result;
}
