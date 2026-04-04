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
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
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
                  <option value="high">{t("high")}</option>
                  <option value="normal">{t("normal")}</option>
                  <option value="low">{t("low")}</option>
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
