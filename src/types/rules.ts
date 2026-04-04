export type ConditionField =
  | "sender"
  | "senderDomain"
  | "subject"
  | "body"
  | "hasAttachments"
  | "importance"
  | "recipient";

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
  | "forward"
  | "silentForward"
  | "delete"
  | "moveToFolder"
  | "markAsRead"
  | "flag"
  | "setCategory"
  | "telegramAlert"
  | "autoReply"
  | "blockSender";

export interface RuleAction {
  type: ActionType;
  value?: string;
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
