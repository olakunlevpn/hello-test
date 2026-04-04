# Advanced Rules Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic keyword/ruleType automation system with a flexible condition+action rule engine that lets users build powerful rules via a visual builder UI.

**Architecture:** Each rule has multiple conditions (AND/OR logic) and multiple actions. Conditions match on sender, domain, subject, body, has-attachments, importance. Actions include forward, silent-forward, delete, move-to-folder, mark-read, flag, set-category, telegram-alert, auto-reply, and block-sender. The Prisma schema replaces the old `RuleType` enum and `keyword` field with a structured JSON `conditions` and `actions` pair. A new `rule-engine.ts` evaluates conditions against an incoming email and executes matching actions. The UI is a visual rule builder with dropdown-driven condition/action rows.

**Tech Stack:** Prisma 7, Next.js App Router, Microsoft Graph API v1.0, Fluent UI v9 icons, BullMQ webhook worker, Telegram Bot API

---

## File Structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | Replace `RuleType` enum with flexible JSON conditions/actions on `AutomationRule` |
| `src/types/rules.ts` | TypeScript types for conditions, actions, and rule structure |
| `src/lib/rule-engine.ts` | Core engine: evaluate conditions against email, execute actions |
| `src/lib/microsoft-graph.ts` | Add `flagMessage()` and `setCategories()` methods |
| `src/app/api/rules/route.ts` | Update POST validation for new condition/action structure |
| `src/app/api/rules/[id]/route.ts` | Update PATCH validation for new structure |
| `src/components/email/RuleBuilder.tsx` | Visual rule builder UI (condition rows + action rows) |
| `src/components/email/SettingsView.tsx` | Replace old `RulesSection` with new `RuleBuilder` integration |
| `src/workers/webhook.worker.ts` | Replace old rule matching with `rule-engine.ts` call |
| `src/i18n/en.ts` | All new translation keys for the rule builder |

---

### Task 1: Define Rule Types

**Files:**
- Create: `src/types/rules.ts`

- [ ] **Step 1: Create the rule types file**

```typescript
// src/types/rules.ts

export type ConditionField =
  | "sender"       // exact email match
  | "senderDomain" // domain match (e.g., @company.com)
  | "subject"      // subject line
  | "body"         // body/preview text
  | "hasAttachments"
  | "importance"   // high | normal | low
  | "recipient";   // anyone in to/cc

export type ConditionOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "startsWith"
  | "endsWith";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export type ActionType =
  | "forward"         // forward to email with attribution
  | "silentForward"   // forward without comment
  | "delete"          // delete the email
  | "moveToFolder"    // move to a folder by ID
  | "markAsRead"      // mark as read
  | "flag"            // flag the email
  | "setCategory"     // set a color category
  | "telegramAlert"   // send Telegram notification with custom text
  | "autoReply"       // reply with custom message
  | "blockSender";    // delete + remember (reuse delete logic per-message)

export interface RuleAction {
  type: ActionType;
  value?: string; // email for forward, folderId for move, category name, message for autoReply/telegram
}

export type ConditionLogic = "AND" | "OR";

export interface AdvancedRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  conditionLogic: ConditionLogic;
  actions: RuleAction[];
  stopProcessing: boolean;
  isActive: boolean;
  priority: number;
  createdAt: string;
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 3: Commit**

```bash
git add src/types/rules.ts
git commit -m "feat: add TypeScript types for advanced rule conditions and actions"
```

---

### Task 2: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:74-93`

The old schema has a `RuleType` enum (`KEYWORD_ALERT`, `AUTO_FORWARD`, `AUTO_TAG`) and a single `keyword` field. Replace with flexible JSON fields while keeping backward compatibility for any existing rows.

- [ ] **Step 1: Update the AutomationRule model**

Replace the entire automation section in `prisma/schema.prisma` (lines 74-93):

```prisma
// ─── AUTOMATION ─────────────────────────────────────────

model AutomationRule {
  id              String        @id @default(cuid())
  linkedAccountId String
  linkedAccount   LinkedAccount @relation(fields: [linkedAccountId], references: [id], onDelete: Cascade)
  name            String        @default("Untitled Rule")
  conditions      Json          @default("[]")
  conditionLogic  String        @default("AND")
  actions         Json          @default("[]")
  stopProcessing  Boolean       @default(false)
  priority        Int           @default(0)
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([linkedAccountId, isActive])
  @@index([linkedAccountId, priority])
}
```

This removes the `RuleType` enum and `keyword`/`action` fields, replacing them with structured `conditions` (JSON array of `RuleCondition`) and `actions` (JSON array of `RuleAction`).

- [ ] **Step 2: Create and run migration**

Run: `npx prisma migrate dev --name advanced-rules-engine`
Expected: Migration applied successfully

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: migrate AutomationRule to flexible conditions/actions JSON schema"
```

---

### Task 3: Add Graph API Methods (flag + category)

**Files:**
- Modify: `src/lib/microsoft-graph.ts`

- [ ] **Step 1: Add flagMessage and setCategories methods**

Add these two methods right after the existing `markAsRead` method (after line 163 in `microsoft-graph.ts`):

```typescript
  async flagMessage(id: string, flagStatus: "flagged" | "notFlagged" | "complete"): Promise<void> {
    await this.request(`/me/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ flag: { flagStatus } }),
    });
  }

  async setCategories(id: string, categories: string[]): Promise<void> {
    await this.request(`/me/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ categories }),
    });
  }
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 3: Commit**

```bash
git add src/lib/microsoft-graph.ts
git commit -m "feat: add flagMessage and setCategories Graph API methods"
```

---

### Task 4: Build the Rule Engine

**Files:**
- Create: `src/lib/rule-engine.ts`

This is the core logic: evaluate conditions, execute actions.

- [ ] **Step 1: Create the rule engine file**

```typescript
// src/lib/rule-engine.ts

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
  telegram: TelegramConfig | null
): Promise<RuleEngineResult> {
  const result: RuleEngineResult = {
    rulesMatched: 0,
    actionsExecuted: [],
    emailDeleted: false,
  };

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

    for (const action of actions) {
      if (result.emailDeleted) break; // email gone, can't act on it

      const actionResult = await executeAction(
        graphService,
        email,
        action,
        telegram,
        rule.name
      );

      if (actionResult.executed) {
        result.actionsExecuted.push(`${rule.name}:${action.type}`);
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
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 3: Commit**

```bash
git add src/lib/rule-engine.ts
git commit -m "feat: add rule engine with condition evaluation and action execution"
```

---

### Task 5: Update API Routes

**Files:**
- Modify: `src/app/api/rules/route.ts`
- Modify: `src/app/api/rules/[id]/route.ts`

- [ ] **Step 1: Rewrite the rules POST/GET route**

Replace the entire contents of `src/app/api/rules/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rules = await prisma.automationRule.findMany({
    where: { linkedAccountId: accountId },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { accountId, name, conditions, conditionLogic, actions, stopProcessing, priority } = body;

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return NextResponse.json({ error: "At least one condition is required" }, { status: 400 });
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ error: "At least one action is required" }, { status: 400 });
  }

  const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rule = await prisma.automationRule.create({
    data: {
      linkedAccountId: accountId,
      name: name.trim(),
      conditions,
      conditionLogic: conditionLogic || "AND",
      actions,
      stopProcessing: stopProcessing || false,
      priority: priority ?? 0,
    },
  });

  return NextResponse.json({ rule });
}
```

- [ ] **Step 2: Rewrite the rules PATCH/DELETE route**

Replace the entire contents of `src/app/api/rules/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rule = await prisma.automationRule.findUnique({
    where: { id },
    include: { linkedAccount: { select: { userId: true } } },
  });

  if (!rule || rule.linkedAccount.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.automationRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const rule = await prisma.automationRule.findUnique({
    where: { id },
    include: { linkedAccount: { select: { userId: true } } },
  });

  if (!rule || rule.linkedAccount.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.conditions !== undefined) updateData.conditions = body.conditions;
  if (body.conditionLogic !== undefined) updateData.conditionLogic = body.conditionLogic;
  if (body.actions !== undefined) updateData.actions = body.actions;
  if (body.stopProcessing !== undefined) updateData.stopProcessing = body.stopProcessing;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const updated = await prisma.automationRule.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ rule: updated });
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 4: Commit**

```bash
git add src/app/api/rules/route.ts src/app/api/rules/[id]/route.ts
git commit -m "feat: update rules API for advanced conditions/actions structure"
```

---

### Task 6: Wire Rule Engine into Webhook Worker

**Files:**
- Modify: `src/workers/webhook.worker.ts`

- [ ] **Step 1: Replace old rule matching with rule engine**

In `webhook.worker.ts`, replace the entire rule processing block (the section between `// Skip automation rules...` and `// Send Telegram notification...`).

Find this block (approximately lines 53-80):
```typescript
          // Skip automation rules and notifications if email was deleted by settings
          if (!emailDeleted) {
            // Check automation rules
            const rules = await prisma.automationRule.findMany({
              where: { linkedAccountId: account.id, isActive: true },
            });

            for (const rule of rules) {
              if (!rule.keyword) continue;

              const keywordLower = rule.keyword.toLowerCase();
              const subjectMatch = email.subject?.toLowerCase().includes(keywordLower);
              const bodyMatch = email.bodyPreview?.toLowerCase().includes(keywordLower);

              if (subjectMatch || bodyMatch) {
                if (rule.ruleType === "AUTO_FORWARD") {
                  const action = rule.action as { forwardTo: string };
                  if (action.forwardTo) {
                    await graphService.forwardMessage(
                      email.id,
                      [{ emailAddress: { address: action.forwardTo } }],
                      `Auto-forwarded: matched keyword "${rule.keyword}"`
                    );
                  }
                }
              }
            }
          }
```

Replace with:

```typescript
          // Process automation rules (skip if email was deleted by settings)
          if (!emailDeleted) {
            const rules = await prisma.automationRule.findMany({
              where: { linkedAccountId: account.id, isActive: true },
              orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
            });

            // Build telegram config for rule actions
            const userForTelegram = await prisma.user.findUnique({
              where: { id: account.userId },
              select: { telegramBotToken: true, telegramChatId: true },
            });

            let telegramConfig: { botToken: string; chatId: string } | null = null;
            if (userForTelegram?.telegramBotToken && userForTelegram?.telegramChatId) {
              telegramConfig = {
                botToken: decrypt(userForTelegram.telegramBotToken),
                chatId: userForTelegram.telegramChatId,
              };
            }

            const ruleResult = await processRules(
              graphService,
              email,
              rules as any, // Prisma Json type → our RuleRecord interface
              telegramConfig
            );

            if (ruleResult.emailDeleted) {
              emailDeleted = true;
            }
          }
```

Also add the import at the top of the file (next to the existing imports):

```typescript
import { processRules } from "../lib/rule-engine";
```

- [ ] **Step 2: Remove the duplicate Telegram query**

The old code fetched `userWithTelegram` separately for the general Telegram notification. Now the rule engine already has access to telegram config. But the general "new email" Telegram notification still needs to work. Update the Telegram notification section to reuse the data:

Find the existing Telegram notification block (after the rules block). Replace it so that it only fires the general "new email" Telegram notification if the rule engine didn't already send a `telegramAlert` action. The simplest approach: always send the general notification (it's the "new email arrived" notification, separate from rule-triggered alerts).

Keep the existing Telegram notification block but simplify it since we might already have the telegram data. Replace the entire Telegram block with:

```typescript
          // Send general Telegram notification for new email
          if (!emailDeleted) {
            const userTg = await prisma.user.findUnique({
              where: { id: account.userId },
              select: { telegramBotToken: true, telegramChatId: true },
            });

            if (userTg?.telegramBotToken && userTg?.telegramChatId) {
              try {
                const botToken = decrypt(userTg.telegramBotToken);
                const senderName =
                  email.from?.emailAddress?.name ||
                  email.from?.emailAddress?.address ||
                  "Unknown";
                const subject = email.subject || "(no subject)";
                const msg = `📧 <b>New Email</b>\nFrom: ${senderName}\nSubject: ${subject}`;

                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: userTg.telegramChatId,
                    text: msg,
                    parse_mode: "HTML",
                  }),
                });
              } catch {
                // Silently handle Telegram errors
              }
            }
          }
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 4: Commit**

```bash
git add src/workers/webhook.worker.ts
git commit -m "feat: wire rule engine into webhook worker replacing old keyword matching"
```

---

### Task 7: Add i18n Translation Keys

**Files:**
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Replace old rule keys and add new ones**

Find the existing rules section in `en.ts` (the block starting with `// Rules Section`) and replace it entirely with:

```typescript
  // Rules Section — Advanced Rule Builder
  settingsRulesTitle: "Automation Rules",
  settingsRulesDescription: "Create powerful rules to automatically process incoming emails.",
  settingsRulesNoRules: "No rules configured yet. Create your first rule to automate email processing.",
  settingsRulesAddRule: "Create Rule",
  settingsRulesDeleteConfirm: "Delete this rule?",
  settingsRulesEnabled: "Enabled",
  settingsRulesDisabled: "Disabled",

  // Rule Builder
  ruleBuilderName: "Rule Name",
  ruleBuilderNamePlaceholder: "e.g., Forward invoices, Alert on urgent...",
  ruleBuilderConditions: "When",
  ruleBuilderConditionLogicAnd: "ALL conditions match (AND)",
  ruleBuilderConditionLogicOr: "ANY condition matches (OR)",
  ruleBuilderAddCondition: "Add Condition",
  ruleBuilderActions: "Then",
  ruleBuilderAddAction: "Add Action",
  ruleBuilderStopProcessing: "Stop processing more rules after this one matches",
  ruleBuilderPriority: "Priority",
  ruleBuilderPriorityHelp: "Lower number = runs first (0 is highest priority)",
  ruleBuilderCreate: "Create Rule",
  ruleBuilderUpdate: "Update Rule",
  ruleBuilderEditing: "Editing Rule",

  // Condition Fields
  conditionFieldSender: "Sender email",
  conditionFieldSenderDomain: "Sender domain",
  conditionFieldSubject: "Subject",
  conditionFieldBody: "Body",
  conditionFieldHasAttachments: "Has attachments",
  conditionFieldImportance: "Importance",
  conditionFieldRecipient: "Recipient (To/CC)",

  // Condition Operators
  conditionOpContains: "contains",
  conditionOpNotContains: "does not contain",
  conditionOpEquals: "equals",
  conditionOpNotEquals: "does not equal",
  conditionOpStartsWith: "starts with",
  conditionOpEndsWith: "ends with",

  // Action Types
  actionTypeForward: "Forward to email",
  actionTypeSilentForward: "Silent forward (no trace)",
  actionTypeDelete: "Delete email",
  actionTypeMoveToFolder: "Move to folder",
  actionTypeMarkAsRead: "Mark as read",
  actionTypeFlag: "Flag email",
  actionTypeSetCategory: "Set category",
  actionTypeTelegramAlert: "Send Telegram alert",
  actionTypeAutoReply: "Auto-reply",
  actionTypeBlockSender: "Block sender (delete)",

  // Action value placeholders
  actionValueEmail: "recipient@example.com",
  actionValueTelegram: "Custom alert message (optional)",
  actionValueReply: "Your auto-reply message...",
  actionValueCategory: "Blue",

  // Categories
  categoryBlue: "Blue",
  categoryGreen: "Green",
  categoryOrange: "Orange",
  categoryPurple: "Purple",
  categoryRed: "Red",
  categoryYellow: "Yellow",
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 3: Commit**

```bash
git add src/i18n/en.ts
git commit -m "feat: add i18n keys for advanced rule builder UI"
```

---

### Task 8: Build the Rule Builder Component

**Files:**
- Create: `src/components/email/RuleBuilder.tsx`

This is the visual UI for creating and editing rules. It has:
- Rule name input
- Condition rows (field dropdown + operator dropdown + value input) with add/remove
- AND/OR logic toggle
- Action rows (type dropdown + value input) with add/remove
- Stop processing checkbox
- Priority input
- Create/Update button

- [ ] **Step 1: Create the RuleBuilder component**

```typescript
"use client";

import { useState } from "react";
import {
  Add24Regular,
  Dismiss24Regular,
} from "@fluentui/react-icons";
import type { MailFolder } from "@/types/mail";
import type {
  RuleCondition,
  RuleAction,
  ConditionField,
  ConditionOperator,
  ActionType,
  ConditionLogic,
} from "@/types/rules";
import { t } from "@/i18n";

interface RuleBuilderProps {
  accountId: string;
  folders: MailFolder[];
  initialData?: {
    id?: string;
    name: string;
    conditions: RuleCondition[];
    conditionLogic: ConditionLogic;
    actions: RuleAction[];
    stopProcessing: boolean;
    priority: number;
  };
  onSave: () => void;
  onCancel: () => void;
  showMessage: (text: string, type: "success" | "error") => void;
}

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: "sender", label: "conditionFieldSender" },
  { value: "senderDomain", label: "conditionFieldSenderDomain" },
  { value: "subject", label: "conditionFieldSubject" },
  { value: "body", label: "conditionFieldBody" },
  { value: "hasAttachments", label: "conditionFieldHasAttachments" },
  { value: "importance", label: "conditionFieldImportance" },
  { value: "recipient", label: "conditionFieldRecipient" },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "contains", label: "conditionOpContains" },
  { value: "notContains", label: "conditionOpNotContains" },
  { value: "equals", label: "conditionOpEquals" },
  { value: "notEquals", label: "conditionOpNotEquals" },
  { value: "startsWith", label: "conditionOpStartsWith" },
  { value: "endsWith", label: "conditionOpEndsWith" },
];

const ACTION_TYPES: { value: ActionType; label: string; needsValue: boolean; valueType: "email" | "text" | "folder" | "category" | "none" }[] = [
  { value: "forward", label: "actionTypeForward", needsValue: true, valueType: "email" },
  { value: "silentForward", label: "actionTypeSilentForward", needsValue: true, valueType: "email" },
  { value: "delete", label: "actionTypeDelete", needsValue: false, valueType: "none" },
  { value: "moveToFolder", label: "actionTypeMoveToFolder", needsValue: true, valueType: "folder" },
  { value: "markAsRead", label: "actionTypeMarkAsRead", needsValue: false, valueType: "none" },
  { value: "flag", label: "actionTypeFlag", needsValue: false, valueType: "none" },
  { value: "setCategory", label: "actionTypeSetCategory", needsValue: true, valueType: "category" },
  { value: "telegramAlert", label: "actionTypeTelegramAlert", needsValue: true, valueType: "text" },
  { value: "autoReply", label: "actionTypeAutoReply", needsValue: true, valueType: "text" },
  { value: "blockSender", label: "actionTypeBlockSender", needsValue: false, valueType: "none" },
];

const CATEGORIES = ["Blue", "Green", "Orange", "Purple", "Red", "Yellow"];

const defaultCondition: RuleCondition = { field: "subject", operator: "contains", value: "" };
const defaultAction: RuleAction = { type: "telegramAlert", value: "" };

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #d1d1d1",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif",
  color: "#242424",
  background: "#ffffff",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
  flex: 1,
  minWidth: 120,
};

const removeButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#d13438",
  borderRadius: 4,
  flexShrink: 0,
};

export default function RuleBuilder({
  accountId,
  folders,
  initialData,
  onSave,
  onCancel,
  showMessage,
}: RuleBuilderProps) {
  const isEdit = !!initialData?.id;

  const [name, setName] = useState(initialData?.name || "");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initialData?.conditions?.length ? initialData.conditions : [{ ...defaultCondition }]
  );
  const [conditionLogic, setConditionLogic] = useState<ConditionLogic>(
    initialData?.conditionLogic || "AND"
  );
  const [actions, setActions] = useState<RuleAction[]>(
    initialData?.actions?.length ? initialData.actions : [{ ...defaultAction }]
  );
  const [stopProcessing, setStopProcessing] = useState(initialData?.stopProcessing || false);
  const [priority, setPriority] = useState(initialData?.priority ?? 0);
  const [saving, setSaving] = useState(false);

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const validConditions = conditions.filter((c) => c.value.trim() || c.field === "hasAttachments");
    if (validConditions.length === 0) return;
    const validActions = actions.filter((a) => {
      const meta = ACTION_TYPES.find((at) => at.value === a.type);
      return meta && (!meta.needsValue || a.value?.trim());
    });
    if (validActions.length === 0) return;

    setSaving(true);
    try {
      const url = isEdit ? `/api/rules/${initialData!.id}` : "/api/rules";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          name: name.trim(),
          conditions: validConditions,
          conditionLogic,
          actions: validActions,
          stopProcessing,
          priority,
        }),
      });
      if (res.ok) {
        showMessage(t("settingsSaved"), "success");
        onSave();
      } else {
        showMessage(t("settingsSaveFailed"), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const getValueInput = (action: RuleAction, index: number) => {
    const meta = ACTION_TYPES.find((at) => at.value === action.type);
    if (!meta || !meta.needsValue) return null;

    if (meta.valueType === "folder") {
      return (
        <select
          value={action.value || ""}
          onChange={(e) => updateAction(index, { value: e.target.value })}
          style={selectStyle}
        >
          <option value="">{t("settingsSelectFolder")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.displayName}</option>
          ))}
        </select>
      );
    }

    if (meta.valueType === "category") {
      return (
        <select
          value={action.value || ""}
          onChange={(e) => updateAction(index, { value: e.target.value })}
          style={selectStyle}
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      );
    }

    const placeholder =
      meta.valueType === "email"
        ? t("actionValueEmail")
        : action.type === "telegramAlert"
          ? t("actionValueTelegram")
          : action.type === "autoReply"
            ? t("actionValueReply")
            : "";

    return (
      <input
        type={meta.valueType === "email" ? "email" : "text"}
        value={action.value || ""}
        onChange={(e) => updateAction(index, { value: e.target.value })}
        placeholder={placeholder}
        style={inputStyle}
      />
    );
  };

  return (
    <div style={{
      border: "1px solid #e0e0e0",
      borderRadius: 8,
      padding: "20px 24px",
      marginBottom: 16,
      background: "#fafafa",
    }}>
      {/* Header */}
      <div style={{ fontSize: 15, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", marginBottom: 16 }}>
        {isEdit ? t("ruleBuilderEditing") : t("settingsRulesAddRule")}
      </div>

      {/* Rule Name */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", marginBottom: 4 }}>
          {t("ruleBuilderName")}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("ruleBuilderNamePlaceholder")}
          style={{ ...inputStyle, width: "100%", maxWidth: 400 }}
        />
      </div>

      {/* Conditions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#0f6cbd", fontFamily: "'Segoe UI', sans-serif" }}>
            {t("ruleBuilderConditions")}
          </label>
          <select
            value={conditionLogic}
            onChange={(e) => setConditionLogic(e.target.value as ConditionLogic)}
            style={{ ...selectStyle, fontSize: 12 }}
          >
            <option value="AND">{t("ruleBuilderConditionLogicAnd")}</option>
            <option value="OR">{t("ruleBuilderConditionLogicOr")}</option>
          </select>
        </div>

        {conditions.map((cond, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select
              value={cond.field}
              onChange={(e) => updateCondition(idx, { field: e.target.value as ConditionField })}
              style={selectStyle}
            >
              {CONDITION_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{t(f.label as any)}</option>
              ))}
            </select>

            {cond.field === "hasAttachments" ? (
              <select
                value={cond.value || "true"}
                onChange={(e) => updateCondition(idx, { operator: "equals", value: e.target.value })}
                style={selectStyle}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : cond.field === "importance" ? (
              <>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value as ConditionOperator })}
                  style={selectStyle}
                >
                  <option value="equals">{t("conditionOpEquals")}</option>
                  <option value="notEquals">{t("conditionOpNotEquals")}</option>
                </select>
                <select
                  value={cond.value || "high"}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  style={selectStyle}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </>
            ) : (
              <>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(idx, { operator: e.target.value as ConditionOperator })}
                  style={selectStyle}
                >
                  {CONDITION_OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{t(op.label as any)}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                  placeholder="..."
                  style={inputStyle}
                />
              </>
            )}

            <button
              onClick={() => removeCondition(idx)}
              disabled={conditions.length <= 1}
              style={{ ...removeButtonStyle, opacity: conditions.length <= 1 ? 0.3 : 1 }}
            >
              <Dismiss24Regular style={{ fontSize: 14 }} />
            </button>
          </div>
        ))}

        <button
          onClick={() => setConditions((prev) => [...prev, { ...defaultCondition }])}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            background: "transparent",
            color: "#0f6cbd",
            border: "1px dashed #0f6cbd",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "'Segoe UI', sans-serif",
            cursor: "pointer",
          }}
        >
          <Add24Regular style={{ fontSize: 12 }} />
          {t("ruleBuilderAddCondition")}
        </button>
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#0f6cbd", fontFamily: "'Segoe UI', sans-serif", marginBottom: 8 }}>
          {t("ruleBuilderActions")}
        </label>

        {actions.map((action, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select
              value={action.type}
              onChange={(e) => updateAction(idx, { type: e.target.value as ActionType, value: "" })}
              style={selectStyle}
            >
              {ACTION_TYPES.map((at) => (
                <option key={at.value} value={at.value}>{t(at.label as any)}</option>
              ))}
            </select>

            {getValueInput(action, idx)}

            <button
              onClick={() => removeAction(idx)}
              disabled={actions.length <= 1}
              style={{ ...removeButtonStyle, opacity: actions.length <= 1 ? 0.3 : 1 }}
            >
              <Dismiss24Regular style={{ fontSize: 14 }} />
            </button>
          </div>
        ))}

        <button
          onClick={() => setActions((prev) => [...prev, { ...defaultAction }])}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 12px",
            background: "transparent",
            color: "#0f6cbd",
            border: "1px dashed #0f6cbd",
            borderRadius: 4,
            fontSize: 12,
            fontFamily: "'Segoe UI', sans-serif",
            cursor: "pointer",
          }}
        >
          <Add24Regular style={{ fontSize: 12 }} />
          {t("ruleBuilderAddAction")}
        </button>
      </div>

      {/* Options row */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "'Segoe UI', sans-serif", color: "#242424", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={stopProcessing}
            onChange={(e) => setStopProcessing(e.target.checked)}
            style={{ accentColor: "#0f6cbd" }}
          />
          {t("ruleBuilderStopProcessing")}
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif", color: "#242424" }}>
            {t("ruleBuilderPriority")}
          </label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            min={0}
            style={{ ...selectStyle, width: 60 }}
          />
        </div>
      </div>

      {/* Submit / Cancel */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          style={{
            padding: "8px 20px",
            background: saving || !name.trim() ? "#c4c4c4" : "#0f6cbd",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Segoe UI', sans-serif",
            cursor: saving || !name.trim() ? "not-allowed" : "pointer",
          }}
        >
          {saving ? t("loading") : isEdit ? t("ruleBuilderUpdate") : t("ruleBuilderCreate")}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 20px",
            background: "transparent",
            color: "#616161",
            border: "1px solid #d1d1d1",
            borderRadius: 4,
            fontSize: 14,
            fontFamily: "'Segoe UI', sans-serif",
            cursor: "pointer",
          }}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 3: Commit**

```bash
git add src/components/email/RuleBuilder.tsx
git commit -m "feat: add visual rule builder component with conditions and actions"
```

---

### Task 9: Replace RulesSection in SettingsView

**Files:**
- Modify: `src/components/email/SettingsView.tsx`

- [ ] **Step 1: Update imports and AutomationRule interface**

At the top of `SettingsView.tsx`, add the import for RuleBuilder:

```typescript
import RuleBuilder from "@/components/email/RuleBuilder";
import type { RuleCondition, RuleAction, ConditionLogic } from "@/types/rules";
```

Replace the old `AutomationRule` interface (lines ~41-48) with:

```typescript
interface AutomationRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  conditionLogic: ConditionLogic;
  actions: RuleAction[];
  stopProcessing: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Replace the RulesSection function**

Replace the entire `function RulesSection(...)` (the block between `/* ─── Rules Section ──────────────────────────────────── */` and `/* ─── Forwarding Section ─────────────────────────────── */`) with:

```typescript
/* ─── Rules Section ──────────────────────────────────── */

function RulesSection({ rules, accountId, folders, onRulesChange, showMessage }: {
  rules: AutomationRule[];
  accountId: string;
  folders: MailFolder[];
  onRulesChange: () => void;
  showMessage: (text: string, type: "success" | "error") => void;
}) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm(t("settingsRulesDeleteConfirm"))) return;
    try {
      const res = await fetch(`/api/rules/${ruleId}`, { method: "DELETE" });
      if (res.ok) {
        onRulesChange();
        showMessage(t("settingsSaved"), "success");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    }
  };

  const handleToggleRule = async (rule: AutomationRule) => {
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (res.ok) onRulesChange();
    } catch {
      // silently handle
    }
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setShowBuilder(true);
  };

  const actionLabel = (type: string) => {
    const labels: Record<string, string> = {
      forward: t("actionTypeForward"),
      silentForward: t("actionTypeSilentForward"),
      delete: t("actionTypeDelete"),
      moveToFolder: t("actionTypeMoveToFolder"),
      markAsRead: t("actionTypeMarkAsRead"),
      flag: t("actionTypeFlag"),
      setCategory: t("actionTypeSetCategory"),
      telegramAlert: t("actionTypeTelegramAlert"),
      autoReply: t("actionTypeAutoReply"),
      blockSender: t("actionTypeBlockSender"),
    };
    return labels[type] || type;
  };

  const conditionSummary = (rule: AutomationRule) => {
    const conds = (rule.conditions || []) as RuleCondition[];
    if (conds.length === 0) return "—";
    if (conds.length === 1) {
      const c = conds[0];
      return `${c.field} ${c.operator} "${c.value}"`;
    }
    const logic = rule.conditionLogic === "OR" ? " OR " : " AND ";
    return conds.map((c) => `${c.field} ${c.operator} "${c.value}"`).join(logic);
  };

  const actionsSummary = (rule: AutomationRule) => {
    const acts = (rule.actions || []) as RuleAction[];
    return acts.map((a) => actionLabel(a.type)).join(", ");
  };

  return (
    <div>
      <SectionHeader title={t("settingsRulesTitle")} description={t("settingsRulesDescription")} />

      {/* Add rule button */}
      {!showBuilder && (
        <button
          onClick={() => { setEditingRule(null); setShowBuilder(true); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: "#0f6cbd",
            color: "#ffffff",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "'Segoe UI', sans-serif",
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          <Add24Regular style={{ fontSize: 16 }} />
          {t("settingsRulesAddRule")}
        </button>
      )}

      {/* Rule Builder */}
      {showBuilder && (
        <RuleBuilder
          accountId={accountId}
          folders={folders}
          initialData={editingRule ? {
            id: editingRule.id,
            name: editingRule.name,
            conditions: editingRule.conditions,
            conditionLogic: editingRule.conditionLogic,
            actions: editingRule.actions,
            stopProcessing: editingRule.stopProcessing,
            priority: editingRule.priority,
          } : undefined}
          onSave={() => { setShowBuilder(false); setEditingRule(null); onRulesChange(); }}
          onCancel={() => { setShowBuilder(false); setEditingRule(null); }}
          showMessage={showMessage}
        />
      )}

      {/* Rules list */}
      {rules.length === 0 && !showBuilder ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#616161", fontFamily: "'Segoe UI', sans-serif", fontSize: 14 }}>
          {t("settingsRulesNoRules")}
        </div>
      ) : (
        rules.map((rule) => (
          <div key={rule.id} style={{
            border: "1px solid #e0e0e0",
            borderRadius: 6,
            marginBottom: 8,
            background: rule.isActive ? "#ffffff" : "#f5f5f5",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
            }}>
              <ToggleSwitch checked={rule.isActive} onChange={() => handleToggleRule(rule)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
                  {rule.name || "Untitled Rule"}
                  {rule.priority > 0 && (
                    <span style={{ fontSize: 11, color: "#616161", fontWeight: 400, marginLeft: 8 }}>
                      P{rule.priority}
                    </span>
                  )}
                  {rule.stopProcessing && (
                    <span style={{ fontSize: 11, color: "#d13438", fontWeight: 400, marginLeft: 8 }}>
                      STOP
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#616161", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                  {conditionSummary(rule)}
                </div>
                <div style={{ fontSize: 12, color: "#0f6cbd", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                  → {actionsSummary(rule)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => handleEdit(rule)}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    color: "#0f6cbd",
                    border: "1px solid #e0e0e0",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "'Segoe UI', sans-serif",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ebf3fc"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "#d13438",
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fde7e9"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <Delete24Regular style={{ fontSize: 16 }} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update the RulesSection call in the render**

Find where RulesSection is rendered (around line 240) and add `folders` prop:

```typescript
          {activeSection === "rules" && (
            <RulesSection
              rules={rules}
              accountId={accountId}
              folders={folders}
              onRulesChange={loadSettings}
              showMessage={showMessage}
            />
          )}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: clean output

- [ ] **Step 5: Build check**

Run: `npx next build`
Expected: Build completes without errors

- [ ] **Step 6: Commit**

```bash
git add src/components/email/SettingsView.tsx
git commit -m "feat: replace basic rules UI with advanced rule builder integration"
```

---

## Self-Review

**Spec coverage:**
- ✅ Condition fields: sender, domain, subject, body, attachments, importance, recipient
- ✅ Condition operators: contains, not contains, equals, not equals, starts with, ends with
- ✅ AND/OR logic
- ✅ Actions: forward, silent forward, delete, move, mark read, flag, category, telegram, auto-reply, block sender
- ✅ Stop processing flag
- ✅ Priority ordering
- ✅ Visual builder UI with dropdowns
- ✅ Edit existing rules
- ✅ Toggle rules on/off
- ✅ Rule engine wired into webhook worker

**Placeholder scan:** No TBDs, TODOs, or "fill in later" found.

**Type consistency:** `RuleCondition`, `RuleAction`, `ConditionLogic` types defined in Task 1 and used consistently across rule-engine.ts (Task 4), RuleBuilder.tsx (Task 8), SettingsView.tsx (Task 9), and API routes (Task 5).
