export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailRecipient {
  emailAddress: EmailAddress;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentBytes?: string;
}

export interface EmailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: "text" | "html";
    content: string;
  };
  from: EmailRecipient;
  toRecipients: EmailRecipient[];
  ccRecipients: EmailRecipient[];
  bccRecipients: EmailRecipient[];
  receivedDateTime: string;
  sentDateTime: string;
  isRead: boolean;
  isDraft: boolean;
  importance: "low" | "normal" | "high";
  hasAttachments: boolean;
  flag: {
    flagStatus: "notFlagged" | "flagged" | "complete";
  };
  parentFolderId: string;
  conversationId: string;
}

export interface MailFolder {
  id: string;
  displayName: string;
  parentFolderId: string | null;
  childFolderCount: number;
  unreadItemCount: number;
  totalItemCount: number;
}

export interface EmailListResponse {
  value: EmailMessage[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

export interface ComposeEmailPayload {
  subject: string;
  body: {
    contentType: "HTML";
    content: string;
  };
  toRecipients: EmailRecipient[];
  ccRecipients?: EmailRecipient[];
  bccRecipients?: EmailRecipient[];
  replyTo?: EmailRecipient[];
  attachments?: {
    "@odata.type": "#microsoft.graph.fileAttachment";
    name: string;
    contentType: string;
    contentBytes: string;
  }[];
}

export interface EmailFilterOptions {
  folderId?: string;
  filter?: string;
  search?: string;
  top?: number;
  skip?: number;
  select?: string;
  orderby?: string;
  nextLink?: string;
}
