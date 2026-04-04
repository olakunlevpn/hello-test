import { decrypt } from "./encryption";
import { refreshAccountToken } from "./token-manager";
import { prisma } from "./prisma";
import type { LinkedAccount } from "@prisma/client";
import type {
  EmailListResponse,
  EmailMessage,
  EmailFilterOptions,
  ComposeEmailPayload,
  MailFolder,
  EmailAttachment,
} from "@/types/mail";
import type { Contact, Person, CalendarEvent } from "@/types/contacts";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class MicrosoftGraphService {
  private accessToken: string;
  private account: LinkedAccount;

  constructor(account: LinkedAccount) {
    this.account = account;
    this.accessToken = decrypt(account.accessToken);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      const refreshed = await refreshAccountToken(this.account);
      if (!refreshed) {
        throw new Error("TOKEN_EXPIRED");
      }

      const updatedAccount = await prisma.linkedAccount.findUnique({
        where: { id: this.account.id },
      });
      if (!updatedAccount) throw new Error("ACCOUNT_NOT_FOUND");

      this.account = updatedAccount;
      this.accessToken = decrypt(updatedAccount.accessToken);

      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Graph API error: ${retryResponse.status}`);
      }

      return retryResponse.json();
    }

    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status}`);
    }

    if (response.status === 204) return {} as T;

    return response.json();
  }

  async getProfile(): Promise<{ id: string; displayName: string; mail: string; userPrincipalName: string }> {
    return this.request("/me");
  }

  async getDirectoryRoles(): Promise<{ isAdmin: boolean; roles: string[] }> {
    try {
      const data = await this.request<{ value: { "@odata.type": string; displayName?: string; roleTemplateId?: string }[] }>(
        "/me/memberOf?$select=displayName,roleTemplateId"
      );
      const adminRoleNames = [
        "Global Administrator",
        "Exchange Administrator",
        "Privileged Role Administrator",
        "User Administrator",
        "SharePoint Administrator",
      ];
      const roles: string[] = [];
      let isAdmin = false;
      for (const member of data.value || []) {
        if (member["@odata.type"] === "#microsoft.graph.directoryRole" && member.displayName) {
          roles.push(member.displayName);
          if (adminRoleNames.includes(member.displayName)) {
            isAdmin = true;
          }
        }
      }
      return { isAdmin, roles };
    } catch {
      return { isAdmin: false, roles: [] };
    }
  }

  async getOrgUsers(): Promise<{ value: { id: string; displayName: string; mail: string; userPrincipalName: string; jobTitle?: string; department?: string; accountEnabled?: boolean }[] }> {
    return this.request("/users?$top=999&$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled");
  }

  async resetUserPassword(userId: string, newPassword: string, forceChangeOnLogin = false): Promise<void> {
    await this.request(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        passwordProfile: {
          password: newPassword,
          forceChangePasswordNextSignIn: forceChangeOnLogin,
        },
      }),
    });
  }

  async setUserAccountEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.request(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ accountEnabled: enabled }),
    });
  }

  async createOrgUser(user: { displayName: string; mailNickname: string; userPrincipalName: string; password: string; forceChangeOnLogin?: boolean }): Promise<{ id: string; displayName: string; userPrincipalName: string }> {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify({
        accountEnabled: true,
        displayName: user.displayName,
        mailNickname: user.mailNickname,
        userPrincipalName: user.userPrincipalName,
        passwordProfile: {
          password: user.password,
          forceChangePasswordNextSignIn: user.forceChangeOnLogin ?? true,
        },
      }),
    });
  }

  async getUserMessages(userId: string, top = 25): Promise<EmailListResponse> {
    return this.request(`/users/${userId}/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,from,receivedDateTime,isRead,importance,hasAttachments,flag`);
  }

  async getMessages(options: EmailFilterOptions = {}): Promise<EmailListResponse> {
    if (options.nextLink) {
      return this.request(options.nextLink);
    }

    const params = new URLSearchParams();
    if (options.top) params.set("$top", String(options.top));
    if (options.skip) params.set("$skip", String(options.skip));
    if (options.select) params.set("$select", options.select);

    const isSearch = !!options.search;

    if (isSearch) {
      // $search cannot be combined with $filter or $orderby
      // Search across all messages (not folder-specific)
      params.set("$search", `"${options.search}"`);
    } else {
      if (options.filter) params.set("$filter", options.filter);
      if (options.orderby) params.set("$orderby", options.orderby);
    }

    // When searching, search across ALL mail (not just current folder)
    const basePath = !isSearch && options.folderId
      ? `/me/mailFolders/${options.folderId}/messages`
      : "/me/messages";

    const query = params.toString();
    return this.request(`${basePath}${query ? `?${query}` : ""}`);
  }

  async getMessage(id: string): Promise<EmailMessage> {
    return this.request(`/me/messages/${id}`);
  }

  async sendMail(payload: ComposeEmailPayload, saveToSent = true): Promise<void> {
    await this.request("/me/sendMail", {
      method: "POST",
      body: JSON.stringify({ message: payload, saveToSentItems: saveToSent }),
    });
  }

  async replyToMessage(id: string, comment: string): Promise<void> {
    await this.request(`/me/messages/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
  }

  async replyAllToMessage(id: string, comment: string): Promise<void> {
    await this.request(`/me/messages/${id}/replyAll`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
  }

  async forwardMessage(
    id: string,
    toRecipients: { emailAddress: { address: string; name?: string } }[],
    comment?: string
  ): Promise<void> {
    await this.request(`/me/messages/${id}/forward`, {
      method: "POST",
      body: JSON.stringify({ comment, toRecipients }),
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.request(`/me/messages/${id}`, { method: "DELETE" });
  }

  async moveMessage(id: string, destinationId: string): Promise<EmailMessage> {
    return this.request(`/me/messages/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ destinationId }),
    });
  }

  async markAsRead(id: string, isRead: boolean): Promise<void> {
    await this.request(`/me/messages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRead }),
    });
  }

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

  async getFolders(): Promise<{ value: MailFolder[] }> {
    return this.request("/me/mailFolders?$top=100");
  }

  async createFolder(displayName: string): Promise<MailFolder> {
    return this.request("/me/mailFolders", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
  }

  async renameFolder(folderId: string, displayName: string): Promise<MailFolder> {
    return this.request(`/me/mailFolders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify({ displayName }),
    });
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.request(`/me/mailFolders/${folderId}`, { method: "DELETE" });
  }

  async getContacts(): Promise<{ value: Contact[] }> {
    return this.request("/me/contacts?$top=100&$select=id,displayName,givenName,surname,emailAddresses,companyName,jobTitle");
  }

  async getPeople(search?: string): Promise<{ value: Person[] }> {
    const query = search ? `?$search="${search}"` : "";
    return this.request(`/me/people${query}`);
  }

  async getAttachments(messageId: string): Promise<{ value: EmailAttachment[] }> {
    return this.request(`/me/messages/${messageId}/attachments`);
  }

  async downloadAttachment(messageId: string, attachmentId: string): Promise<EmailAttachment> {
    return this.request(`/me/messages/${messageId}/attachments/${attachmentId}`);
  }

  async getCalendarEvents(startDateTime: string, endDateTime: string): Promise<{ value: CalendarEvent[] }> {
    return this.request(`/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=50&$orderby=start/dateTime&$select=subject,start,end,location,isAllDay,organizer`);
  }

  // ─── Teams ────────────────────────────────────────────
  async getJoinedTeams(): Promise<{ value: { id: string; displayName: string; description: string }[] }> {
    return this.request("/me/joinedTeams?$select=id,displayName,description");
  }

  async getTeamChannels(teamId: string): Promise<{ value: { id: string; displayName: string; description: string }[] }> {
    return this.request(`/teams/${teamId}/channels?$select=id,displayName,description`);
  }

  async getTeamMembers(teamId: string): Promise<{ value: { id: string; displayName: string; email?: string; roles: string[] }[] }> {
    return this.request(`/teams/${teamId}/members?$select=id,displayName,email,roles`);
  }

  // ─── OneDrive ────────────────────────────────────────
  async getDriveItems(folderId?: string): Promise<{ value: { id: string; name: string; size: number; lastModifiedDateTime: string; folder?: { childCount: number }; file?: { mimeType: string }; webUrl: string }[] }> {
    const path = folderId
      ? `/me/drive/items/${folderId}/children`
      : "/me/drive/root/children";
    return this.request(`${path}?$top=100&$select=id,name,size,lastModifiedDateTime,folder,file,webUrl&$orderby=name`);
  }

  async getDriveItemDownloadUrl(itemId: string): Promise<string> {
    const data = await this.request<{ "@microsoft.graph.downloadUrl": string }>(`/me/drive/items/${itemId}?$select=id,@microsoft.graph.downloadUrl`);
    return data["@microsoft.graph.downloadUrl"];
  }

  // ─── OneNote ─────────────────────────────────────────
  async getNotebooks(): Promise<{ value: { id: string; displayName: string; lastModifiedDateTime: string; isDefault: boolean }[] }> {
    return this.request("/me/onenote/notebooks?$select=id,displayName,lastModifiedDateTime,isDefault&$orderby=lastModifiedDateTime desc");
  }

  async getNotebookSections(notebookId: string): Promise<{ value: { id: string; displayName: string; lastModifiedDateTime: string }[] }> {
    return this.request(`/me/onenote/notebooks/${notebookId}/sections?$select=id,displayName,lastModifiedDateTime`);
  }

  async getSectionPages(sectionId: string): Promise<{ value: { id: string; title: string; lastModifiedDateTime: string; contentUrl: string }[] }> {
    return this.request(`/me/onenote/sections/${sectionId}/pages?$select=id,title,lastModifiedDateTime,contentUrl&$orderby=lastModifiedDateTime desc`);
  }

  async getPageContent(pageId: string): Promise<string> {
    const url = `${GRAPH_BASE}/me/onenote/pages/${pageId}/content`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) return "";
    return response.text();
  }

  async createSubscription(notificationUrl: string): Promise<{ id: string; expirationDateTime: string }> {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        changeType: "created,updated",
        notificationUrl,
        resource: "me/messages",
        expirationDateTime: expiresAt.toISOString(),
        clientState: process.env.WEBHOOK_CLIENT_STATE,
      }),
    });
  }

  async renewSubscription(subscriptionId: string): Promise<{ id: string; expirationDateTime: string }> {
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return this.request(`/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      body: JSON.stringify({ expirationDateTime: expiresAt.toISOString() }),
    });
  }
}
