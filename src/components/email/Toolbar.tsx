"use client";

import { Button, Divider } from "@fluentui/react-components";
import {
  MailAdd24Regular,
  ArrowReply20Regular,
  ArrowReplyAll20Regular,
  ArrowForward20Regular,
  Delete20Regular,
  Archive20Regular,
  FolderArrowRight20Regular,
  MailRead20Regular,
  EyeOff20Regular,
  Eye20Regular,
} from "@fluentui/react-icons";
import { t } from "@/i18n";

interface ToolbarProps {
  onCompose: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onMoveToFolder: () => void;
  onMarkUnread: () => void;
  hasSelectedMessage: boolean;
  ghostModeActive: boolean;
  onGhostModeToggle: () => void;
}

export default function Toolbar({
  onCompose,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onArchive,
  onMoveToFolder,
  onMarkUnread,
  hasSelectedMessage,
  ghostModeActive,
  onGhostModeToggle,
}: ToolbarProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "6px 12px",
      height: 44,
    }}>
      <Button
        appearance="primary"
        icon={<MailAdd24Regular />}
        onClick={onCompose}
        size="small"
        style={{ borderRadius: 4 }}
      >
        {t("compose")}
      </Button>

      <Divider vertical style={{ height: 24, margin: "0 8px" }} />

      <Button appearance="subtle" icon={<ArrowReply20Regular />} onClick={onReply} disabled={!hasSelectedMessage} size="small">
        {t("reply")}
      </Button>
      <Button appearance="subtle" icon={<ArrowReplyAll20Regular />} onClick={onReplyAll} disabled={!hasSelectedMessage} size="small">
        {t("replyAll")}
      </Button>
      <Button appearance="subtle" icon={<ArrowForward20Regular />} onClick={onForward} disabled={!hasSelectedMessage} size="small">
        {t("forward")}
      </Button>

      <Divider vertical style={{ height: 24, margin: "0 8px" }} />

      <Button appearance="subtle" icon={<Delete20Regular />} onClick={onDelete} disabled={!hasSelectedMessage} size="small">
        {t("deleteEmail")}
      </Button>
      <Button appearance="subtle" icon={<Archive20Regular />} onClick={onArchive} disabled={!hasSelectedMessage} size="small">
        {t("archiveEmail")}
      </Button>
      <Button appearance="subtle" icon={<FolderArrowRight20Regular />} onClick={onMoveToFolder} disabled={!hasSelectedMessage} size="small">
        {t("moveToFolder")}
      </Button>

      <Divider vertical style={{ height: 24, margin: "0 8px" }} />

      <Button appearance="subtle" icon={<MailRead20Regular />} onClick={onMarkUnread} disabled={!hasSelectedMessage} size="small">
        {t("markUnread")}
      </Button>

      <div style={{ flex: 1 }} />

      <Button
        appearance={ghostModeActive ? "primary" : "subtle"}
        icon={ghostModeActive ? <EyeOff20Regular /> : <Eye20Regular />}
        onClick={onGhostModeToggle}
        size="small"
        style={{
          borderRadius: 4,
          background: ghostModeActive ? "#d13438" : undefined,
          borderColor: ghostModeActive ? "#d13438" : undefined,
        }}
      >
        {ghostModeActive ? t("ghostModeOn") : t("ghostModeOff")}
      </Button>
    </div>
  );
}
