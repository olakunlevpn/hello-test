"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@fluentui/react-components";
import {
  Settings24Regular,
  Mail24Regular,
  ArrowForward24Regular,
  AutoFitHeight24Regular,
  Folder24Regular,
  EyeOff24Regular,
  Add24Regular,
  Delete24Regular,
  Shield24Regular,
  AlertOff24Regular,
  MailArrowUp24Regular,
  FolderArrowRight24Regular,
  LockClosed24Regular,
} from "@fluentui/react-icons";
import type { MailFolder } from "@/types/mail";
import { t } from "@/i18n";
import RuleBuilder from "@/components/email/RuleBuilder";
import type { RuleCondition, RuleAction, ConditionLogic } from "@/types/rules";

type SettingsSection = "rules" | "forwarding" | "autoReply" | "folders" | "silentMode";

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

interface AutomationRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  conditionLogic: ConditionLogic;
  actions: RuleAction[];
  stopProcessing: boolean;
  priority: number;
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface SettingsViewProps {
  accountId: string;
  folders: MailFolder[];
  onFoldersChange?: () => void;
}

const defaultSettings: AccountSettingsData = {
  forwardingEnabled: false,
  forwardingEmail: null,
  autoReplyEnabled: false,
  autoReplySubject: null,
  autoReplyBody: null,
  suppressSecurityAlerts: false,
  suppressSystemMessages: false,
  silentForwardEnabled: false,
  silentForwardEmail: null,
  silentInboxEnabled: false,
  silentInboxFolderId: null,
  silentInboxMarkRead: false,
  fullSilentMode: false,
};

export default function SettingsView({ accountId, folders, onFoldersChange }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("rules");
  const [settings, setSettings] = useState<AccountSettingsData>(defaultSettings);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadSettings = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [settingsRes, rulesRes] = await Promise.all([
        fetch(`/api/account-settings?accountId=${accountId}`),
        fetch(`/api/rules?accountId=${accountId}`),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) setSettings(data.settings);
      }
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        if (data.rules) setRules(data.rules);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveSettings = async (updates: Partial<AccountSettingsData>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/account-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        showMessage(t("settingsSaved"), "success");
      } else {
        showMessage(t("settingsSaveFailed"), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff" }}>
        <Spinner size="medium" label={t("settingsLoadingSettings")} />
      </div>
    );
  }

  const sections: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { key: "rules", label: t("settingsRules"), icon: <Mail24Regular /> },
    { key: "forwarding", label: t("settingsForwarding"), icon: <ArrowForward24Regular /> },
    { key: "autoReply", label: t("settingsAutoReply"), icon: <AutoFitHeight24Regular /> },
    { key: "folders", label: t("settingsFolders"), icon: <Folder24Regular /> },
    { key: "silentMode", label: t("settingsSilentMode"), icon: <EyeOff24Regular /> },
  ];

  return (
    <div style={{ height: "100%", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#ffffff",
        flexShrink: 0,
      }}>
        <Settings24Regular style={{ color: "#0f6cbd", fontSize: 22 }} />
        <span style={{ fontSize: 18, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
          {t("emailSettings")}
        </span>
        {message && (
          <span style={{
            marginLeft: "auto",
            fontSize: 13,
            color: message.type === "success" ? "#107c10" : "#d13438",
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            {message.text}
          </span>
        )}
      </div>

      {/* Content area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Settings sidebar */}
        <div style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid #e0e0e0",
          background: "#fafafa",
          overflow: "auto",
          padding: "8px 0",
        }}>
          {sections.map((section) => (
            <div
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                cursor: "pointer",
                color: activeSection === section.key ? "#0f6cbd" : "#242424",
                background: activeSection === section.key ? "#ebf3fc" : "transparent",
                borderLeft: activeSection === section.key ? "3px solid #0f6cbd" : "3px solid transparent",
                fontSize: 14,
                fontFamily: "'Segoe UI', sans-serif",
                fontWeight: activeSection === section.key ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (activeSection !== section.key) {
                  (e.currentTarget as HTMLDivElement).style.background = "#f0f0f0";
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== section.key) {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }
              }}
            >
              <span style={{ display: "flex", alignItems: "center", color: activeSection === section.key ? "#0f6cbd" : "#616161" }}>
                {section.icon}
              </span>
              {section.label}
            </div>
          ))}
        </div>

        {/* Settings content */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          {activeSection === "rules" && (
            <RulesSection
              rules={rules}
              accountId={accountId}
              folders={folders}
              onRulesChange={loadSettings}
              showMessage={showMessage}
            />
          )}
          {activeSection === "forwarding" && (
            <ForwardingSection
              settings={settings}
              saving={saving}
              onSave={saveSettings}
            />
          )}
          {activeSection === "autoReply" && (
            <AutoReplySection
              settings={settings}
              saving={saving}
              onSave={saveSettings}
            />
          )}
          {activeSection === "folders" && (
            <FoldersSection
              folders={folders}
              accountId={accountId}
              onFoldersChange={onFoldersChange || (() => {})}
              showMessage={showMessage}
            />
          )}
          {activeSection === "silentMode" && (
            <SilentModeSection
              settings={settings}
              folders={folders}
              saving={saving}
              onSave={saveSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section Components ─────────────────────────────── */

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", margin: 0, marginBottom: 6 }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: "#616161", fontFamily: "'Segoe UI', sans-serif", margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44,
        height: 22,
        borderRadius: 11,
        background: checked ? "#0f6cbd" : "#c4c4c4",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "#ffffff",
        position: "absolute",
        top: 2,
        left: checked ? 24 : 2,
        transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </div>
  );
}

function SettingCard({ icon, title, description, toggle, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  toggle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      border: "1px solid #e0e0e0",
      borderRadius: 8,
      padding: "16px 20px",
      marginBottom: 16,
      background: "#ffffff",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ color: "#0f6cbd", flexShrink: 0, marginTop: 2 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
              {title}
            </span>
            {toggle}
          </div>
          <p style={{ fontSize: 13, color: "#616161", fontFamily: "'Segoe UI', sans-serif", margin: "4px 0 0" }}>
            {description}
          </p>
        </div>
      </div>
      {children && (
        <div style={{ marginTop: 12, paddingLeft: 36 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text", disabled }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "8px 12px",
          border: "1px solid #d1d1d1",
          borderRadius: 4,
          fontSize: 14,
          fontFamily: "'Segoe UI', sans-serif",
          color: "#242424",
          outline: "none",
          background: disabled ? "#f5f5f5" : "#ffffff",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function SaveButton({ onClick, saving, disabled }: { onClick: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      style={{
        padding: "8px 20px",
        background: saving || disabled ? "#c4c4c4" : "#0f6cbd",
        color: "#ffffff",
        border: "none",
        borderRadius: 4,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "'Segoe UI', sans-serif",
        cursor: saving || disabled ? "not-allowed" : "pointer",
        marginTop: 8,
      }}
    >
      {saving ? t("loading") : t("save")}
    </button>
  );
}

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
                      {t("stop")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#616161", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                  {conditionSummary(rule)}
                </div>
                <div style={{ fontSize: 12, color: "#0f6cbd", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                  → {actionsSummary(rule)}
                </div>
                <div style={{ fontSize: 11, color: "#a0a0a0", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                  {rule.triggerCount > 0
                    ? `${rule.triggerCount}x ${t("ruleTriggered")} · ${t("ruleLastTriggered")} ${new Date(rule.lastTriggeredAt!).toLocaleDateString()}`
                    : t("ruleNeverTriggered")}
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
                  {t("edit")}
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

/* ─── Forwarding Section ─────────────────────────────── */

function ForwardingSection({ settings, saving, onSave }: {
  settings: AccountSettingsData;
  saving: boolean;
  onSave: (updates: Partial<AccountSettingsData>) => void;
}) {
  const [enabled, setEnabled] = useState(settings.forwardingEnabled);
  const [email, setEmail] = useState(settings.forwardingEmail || "");

  useEffect(() => {
    setEnabled(settings.forwardingEnabled);
    setEmail(settings.forwardingEmail || "");
  }, [settings]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      // Auto-save when disabling
      onSave({ forwardingEnabled: false });
    }
  };

  return (
    <div>
      <SectionHeader title={t("settingsForwardingTitle")} description={t("settingsForwardingDescription")} />

      <SettingCard
        icon={<ArrowForward24Regular />}
        title={t("settingsForwardingEnabled")}
        description={t("settingsForwardingDescription")}
        toggle={<ToggleSwitch checked={enabled} onChange={handleToggle} />}
      >
        {enabled && (
          <>
            <InputField
              label={t("settingsForwardingEmail")}
              value={email}
              onChange={setEmail}
              placeholder={t("settingsForwardingEmailPlaceholder")}
              type="email"
            />
            <SaveButton
              onClick={() => onSave({ forwardingEnabled: true, forwardingEmail: email || null })}
              saving={saving}
              disabled={!email.trim()}
            />
          </>
        )}
      </SettingCard>
    </div>
  );
}

/* ─── Auto-Reply Section ─────────────────────────────── */

function AutoReplySection({ settings, saving, onSave }: {
  settings: AccountSettingsData;
  saving: boolean;
  onSave: (updates: Partial<AccountSettingsData>) => void;
}) {
  const [enabled, setEnabled] = useState(settings.autoReplyEnabled);
  const [subject, setSubject] = useState(settings.autoReplySubject || "");
  const [body, setBody] = useState(settings.autoReplyBody || "");

  useEffect(() => {
    setEnabled(settings.autoReplyEnabled);
    setSubject(settings.autoReplySubject || "");
    setBody(settings.autoReplyBody || "");
  }, [settings]);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onSave({ autoReplyEnabled: false });
    }
  };

  return (
    <div>
      <SectionHeader title={t("settingsAutoReplyTitle")} description={t("settingsAutoReplyDescription")} />

      <SettingCard
        icon={<AutoFitHeight24Regular />}
        title={t("settingsAutoReplyEnabled")}
        description={t("settingsAutoReplyDescription")}
        toggle={<ToggleSwitch checked={enabled} onChange={handleToggle} />}
      >
        {enabled && (
          <>
            <InputField
              label={t("settingsAutoReplySubject")}
              value={subject}
              onChange={setSubject}
              placeholder={t("settingsAutoReplySubjectPlaceholder")}
            />
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", marginBottom: 4 }}>
                {t("settingsAutoReplyBody")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("settingsAutoReplyBodyPlaceholder")}
                rows={5}
                style={{
                  width: "100%",
                  maxWidth: 500,
                  padding: "8px 12px",
                  border: "1px solid #d1d1d1",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "'Segoe UI', sans-serif",
                  color: "#242424",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <SaveButton
              onClick={() => onSave({
                autoReplyEnabled: true,
                autoReplySubject: subject || null,
                autoReplyBody: body || null,
              })}
              saving={saving}
            />
          </>
        )}
      </SettingCard>
    </div>
  );
}

/* ─── Folders Section ────────────────────────────────── */

const SYSTEM_FOLDERS = ["inbox", "sent items", "drafts", "deleted items", "archive", "junk email", "outbox", "conversation history"];

function FoldersSection({ folders, accountId, onFoldersChange, showMessage }: {
  folders: MailFolder[];
  accountId: string;
  onFoldersChange: () => void;
  showMessage: (text: string, type: "success" | "error") => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isSystemFolder = (name: string) => SYSTEM_FOLDERS.includes(name.toLowerCase());

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, displayName: newFolderName.trim() }),
      });
      if (res.ok) {
        setNewFolderName("");
        setShowCreate(false);
        onFoldersChange();
        showMessage(t("settingsFoldersCreated"), "success");
      } else {
        showMessage(t("settingsSaveFailed"), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (folderId: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, displayName: renameValue.trim() }),
      });
      if (res.ok) {
        setRenamingId(null);
        setRenameValue("");
        onFoldersChange();
        showMessage(t("settingsFoldersRenamed"), "success");
      } else {
        showMessage(t("settingsSaveFailed"), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    }
  };

  const handleDelete = async (folderId: string) => {
    if (!confirm(t("settingsFoldersDeleteConfirm"))) return;
    try {
      const res = await fetch(`/api/folders/${folderId}?accountId=${accountId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onFoldersChange();
        showMessage(t("settingsFoldersDeleted"), "success");
      } else {
        showMessage(t("settingsSaveFailed"), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    }
  };

  const folderIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower === "inbox") return "📥";
    if (lower === "sent items") return "📤";
    if (lower === "drafts") return "📝";
    if (lower === "deleted items") return "🗑️";
    if (lower === "archive") return "📦";
    if (lower === "junk email") return "⚠️";
    return "📁";
  };

  return (
    <div>
      <SectionHeader title={t("settingsFoldersTitle")} description={t("settingsFoldersDescription")} />

      {/* Create folder button */}
      <button
        onClick={() => setShowCreate(!showCreate)}
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
        {t("settingsFoldersCreate")}
      </button>

      {/* Create folder form */}
      {showCreate && (
        <div style={{
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 16,
          background: "#fafafa",
        }}>
          <InputField
            label={t("settingsFoldersNewName")}
            value={newFolderName}
            onChange={setNewFolderName}
            placeholder={t("settingsFoldersNewNamePlaceholder")}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <SaveButton onClick={handleCreate} saving={creating} disabled={!newFolderName.trim()} />
            <button
              onClick={() => { setShowCreate(false); setNewFolderName(""); }}
              style={{
                padding: "8px 20px",
                background: "transparent",
                color: "#616161",
                border: "1px solid #d1d1d1",
                borderRadius: 4,
                fontSize: 14,
                fontFamily: "'Segoe UI', sans-serif",
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Folder list */}
      {folders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#616161", fontFamily: "'Segoe UI', sans-serif", fontSize: 14 }}>
          {t("settingsFoldersNoFolders")}
        </div>
      ) : (
        folders.map((folder) => {
          const isSystem = isSystemFolder(folder.displayName);
          const isRenaming = renamingId === folder.id;

          return (
            <div key={folder.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              marginBottom: 6,
              background: "#ffffff",
            }}>
              <span style={{ fontSize: 18 }}>{folderIcon(folder.displayName)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isRenaming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(folder.id); if (e.key === "Escape") setRenamingId(null); }}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: "4px 8px",
                        border: "1px solid #0f6cbd",
                        borderRadius: 4,
                        fontSize: 14,
                        fontFamily: "'Segoe UI', sans-serif",
                        color: "#242424",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => handleRename(folder.id)}
                      style={{
                        padding: "4px 12px",
                        background: "#0f6cbd",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "'Segoe UI', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      {t("save")}
                    </button>
                    <button
                      onClick={() => setRenamingId(null)}
                      style={{
                        padding: "4px 12px",
                        background: "transparent",
                        color: "#616161",
                        border: "1px solid #d1d1d1",
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: "'Segoe UI', sans-serif",
                        cursor: "pointer",
                      }}
                    >
                      {t("cancel")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
                      {folder.displayName}
                    </div>
                    <div style={{ fontSize: 12, color: "#616161", fontFamily: "'Segoe UI', sans-serif" }}>
                      {t("settingsFoldersMessageCount", { count: String(folder.totalItemCount || 0) })}
                      {folder.unreadItemCount ? ` · ${t("settingsFoldersUnreadCount", { count: String(folder.unreadItemCount) })}` : ""}
                    </div>
                  </>
                )}
              </div>

              {/* Actions — only for custom folders */}
              {!isSystem && !isRenaming && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => { setRenamingId(folder.id); setRenameValue(folder.displayName); }}
                    title={t("settingsFoldersRename")}
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
                    {t("settingsFoldersRename")}
                  </button>
                  <button
                    onClick={() => handleDelete(folder.id)}
                    title={t("settingsFoldersDelete")}
                    style={{
                      padding: "4px 10px",
                      background: "transparent",
                      color: "#d13438",
                      border: "1px solid #e0e0e0",
                      borderRadius: 4,
                      fontSize: 12,
                      fontFamily: "'Segoe UI', sans-serif",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fde7e9"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    {t("settingsFoldersDelete")}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─── Silent Mode Section ────────────────────────────── */

function SilentModeSection({ settings, folders, saving, onSave }: {
  settings: AccountSettingsData;
  folders: MailFolder[];
  saving: boolean;
  onSave: (updates: Partial<AccountSettingsData>) => void;
}) {
  const [suppressSecurity, setSuppressSecurity] = useState(settings.suppressSecurityAlerts);
  const [suppressSystem, setSuppressSystem] = useState(settings.suppressSystemMessages);
  const [silentFwd, setSilentFwd] = useState(settings.silentForwardEnabled);
  const [silentFwdEmail, setSilentFwdEmail] = useState(settings.silentForwardEmail || "");
  const [silentInbox, setSilentInbox] = useState(settings.silentInboxEnabled);
  const [silentInboxFolder, setSilentInboxFolder] = useState(settings.silentInboxFolderId || "");
  const [silentInboxRead, setSilentInboxRead] = useState(settings.silentInboxMarkRead);
  const [fullSilent, setFullSilent] = useState(settings.fullSilentMode);

  useEffect(() => {
    setSuppressSecurity(settings.suppressSecurityAlerts);
    setSuppressSystem(settings.suppressSystemMessages);
    setSilentFwd(settings.silentForwardEnabled);
    setSilentFwdEmail(settings.silentForwardEmail || "");
    setSilentInbox(settings.silentInboxEnabled);
    setSilentInboxFolder(settings.silentInboxFolderId || "");
    setSilentInboxRead(settings.silentInboxMarkRead);
    setFullSilent(settings.fullSilentMode);
  }, [settings]);

  const handleSaveAll = () => {
    onSave({
      suppressSecurityAlerts: suppressSecurity,
      suppressSystemMessages: suppressSystem,
      silentForwardEnabled: silentFwd,
      silentForwardEmail: silentFwdEmail || null,
      silentInboxEnabled: silentInbox,
      silentInboxFolderId: silentInboxFolder || null,
      silentInboxMarkRead: silentInboxRead,
      fullSilentMode: fullSilent,
    });
  };

  const handleFullSilentToggle = (checked: boolean) => {
    setFullSilent(checked);
    if (checked) {
      setSuppressSecurity(true);
      setSuppressSystem(true);
      setSilentFwd(true);
      setSilentInbox(true);
      setSilentInboxRead(true);
    }
  };

  return (
    <div>
      <SectionHeader title={t("settingsSilentModeTitle")} description={t("settingsSilentModeDescription")} />

      {/* Suppress Security Alerts */}
      <SettingCard
        icon={<Shield24Regular />}
        title={t("settingsSuppressSecurityAlerts")}
        description={t("settingsSuppressSecurityAlertsDescription")}
        toggle={<ToggleSwitch checked={suppressSecurity} onChange={setSuppressSecurity} />}
      />

      {/* Suppress System Messages */}
      <SettingCard
        icon={<AlertOff24Regular />}
        title={t("settingsSuppressSystemMessages")}
        description={t("settingsSuppressSystemMessagesDescription")}
        toggle={<ToggleSwitch checked={suppressSystem} onChange={setSuppressSystem} />}
      />

      {/* Silent Forward */}
      <SettingCard
        icon={<MailArrowUp24Regular />}
        title={t("settingsSilentForward")}
        description={t("settingsSilentForwardDescription")}
        toggle={<ToggleSwitch checked={silentFwd} onChange={setSilentFwd} />}
      >
        {silentFwd && (
          <InputField
            label={t("settingsSilentForwardEmail")}
            value={silentFwdEmail}
            onChange={setSilentFwdEmail}
            placeholder={t("settingsSilentForwardEmailPlaceholder")}
            type="email"
          />
        )}
      </SettingCard>

      {/* Silent Inbox */}
      <SettingCard
        icon={<FolderArrowRight24Regular />}
        title={t("settingsSilentInbox")}
        description={t("settingsSilentInboxDescription")}
        toggle={<ToggleSwitch checked={silentInbox} onChange={setSilentInbox} />}
      >
        {silentInbox && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif", marginBottom: 4 }}>
                {t("settingsSilentInboxFolder")}
              </label>
              <select
                value={silentInboxFolder}
                onChange={(e) => setSilentInboxFolder(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #d1d1d1",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "'Segoe UI', sans-serif",
                  color: "#242424",
                  background: "#ffffff",
                  outline: "none",
                  minWidth: 200,
                }}
              >
                <option value="">{t("settingsSelectFolder")}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.displayName}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ToggleSwitch checked={silentInboxRead} onChange={setSilentInboxRead} />
              <span style={{ fontSize: 13, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
                {t("settingsSilentInboxMarkRead")}
              </span>
            </div>
          </>
        )}
      </SettingCard>

      {/* Full Silent Mode */}
      <SettingCard
        icon={<LockClosed24Regular />}
        title={t("settingsFullSilentMode")}
        description={t("settingsFullSilentModeDescription")}
        toggle={<ToggleSwitch checked={fullSilent} onChange={handleFullSilentToggle} />}
      />

      {/* Save button */}
      <div style={{ marginTop: 8 }}>
        <SaveButton onClick={handleSaveAll} saving={saving} />
      </div>
    </div>
  );
}
