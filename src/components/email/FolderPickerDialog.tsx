"use client";

import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  Button,
} from "@fluentui/react-components";
import { Dismiss24Regular, Folder24Regular } from "@fluentui/react-icons";
import type { MailFolder } from "@/types/mail";
import { t } from "@/i18n";

interface FolderPickerDialogProps {
  open: boolean;
  onClose: () => void;
  folders: MailFolder[];
  currentFolderId: string | null;
  onMove: (folderId: string) => void;
}

export default function FolderPickerDialog({
  open,
  onClose,
  folders,
  currentFolderId,
  onMove,
}: FolderPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface style={{ maxWidth: 400 }}>
        <DialogTitle
          action={<Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} />}
        >
          {t("moveToFolder")}
        </DialogTitle>
        <DialogBody>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {folders
              .filter((f) => f.id !== currentFolderId)
              .map((folder) => (
                <Button
                  key={folder.id}
                  appearance="subtle"
                  icon={<Folder24Regular />}
                  onClick={() => {
                    onMove(folder.id);
                    onClose();
                  }}
                  style={{ justifyContent: "flex-start" }}
                >
                  {folder.displayName}
                </Button>
              ))}
          </div>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
