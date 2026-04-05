"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GlitchText from "@/components/ui/glitch-text";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CreditCard,
  Settings,
  Mail,
  FileText,
  KeyRound,
  Activity,
  X,
  AtSign,
  Send,
  Contact,
  Calendar,
  Users,
  HardDrive,
  StickyNote,
  EyeOff,
  Radar,
  Shield,
  Ear,
  Bot,
  Code,
  LogOut,
  MessageCircle,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { TranslationKey } from "@/i18n";

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: TranslationKey;
  comingSoon?: boolean;
}

interface NavGroup {
  label: TranslationKey;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "sidebarMain",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "overview" },
      { href: "/dashboard/token-vault", icon: KeyRound, label: "tokenVault" },
      { href: "/dashboard/invitations", icon: FileText, label: "invitations" },
    ],
  },
  {
    label: "sidebarEmail",
    items: [
      { href: "/dashboard/accounts", icon: Mail, label: "inbox" },
      { href: "/dashboard/email-sender", icon: Send, label: "b2bSender" },
      { href: "/dashboard/rules-stealth", icon: EyeOff, label: "rulesStealth" },
      { href: "/dashboard/email-extractor", icon: AtSign, label: "emailExtractor" },
    ],
  },
  {
    label: "sidebarIntel",
    items: [
      { href: "/dashboard/account-intel", icon: Radar, label: "accountIntel" },
      { href: "/dashboard/org-access", icon: Shield, label: "adminControl" },
      { href: "/dashboard/keyword-listener", icon: Ear, label: "keywordListener" },
      { href: "/dashboard/ai-assistant", icon: Bot, label: "aiAssistant", comingSoon: true },
    ],
  },
  {
    label: "sidebarData",
    items: [
      { href: "/dashboard/contacts", icon: Contact, label: "contacts" },
      { href: "/dashboard/calendar", icon: Calendar, label: "calendar" },
      { href: "/dashboard/teams", icon: Users, label: "teams" },
      { href: "/dashboard/onedrive", icon: HardDrive, label: "oneDrive" },
      { href: "/dashboard/onenote", icon: StickyNote, label: "oneNote" },
    ],
  },
  {
    label: "sidebarSystem",
    items: [
      { href: "/dashboard/activity-log", icon: Activity, label: "activityLog" },
      { href: "/dashboard/billing", icon: CreditCard, label: "billing" },
    ],
  },
];

interface DashboardSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const userRole = (session?.user as { role?: string })?.role;
  const isAdmin = userRole === "ADMIN";
  const [telegramUrl, setTelegramUrl] = useState("");

  useEffect(() => {
    fetch("/api/system-settings?key=telegramChannelUrl")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.value) setTelegramUrl(data.value); })
      .catch(() => {});
  }, []);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        "flex h-screen w-64 flex-col border-r border-border bg-card",
        "fixed z-50 md:relative md:z-auto",
        "transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="flex items-center">
            <Mail className="mr-2 h-5 w-5 text-primary" />
            <GlitchText text={t("appName")} className="text-lg" />
          </div>
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1 rounded hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {t(group.label)}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  if (item.comingSoon) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground/40 cursor-default"
                      >
                        <item.icon className="h-4 w-4" />
                        {t(item.label)}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {t(item.label)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tools section */}
          <div className="mb-4">
            <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {t("sidebarTools")}
            </div>
            <div className="space-y-0.5">
              <Link
                href="/dashboard/tools"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/dashboard/tools")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Code className="h-4 w-4" />
                {t("generateCode")}
              </Link>
              <Link
                href="/dashboard/settings"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === "/dashboard/settings"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-4 w-4" />
                {t("settings")}
              </Link>

              {/* Join Channel */}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {t("joinChannel")}
                </a>
              )}

              {/* PRO Badge — hidden for admins */}
              {hasActiveSubscription && !isAdmin && (
                <div className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-700/80 text-amber-200">
                    <Crown className="h-3 w-3" />
                    {t("pro")}
                  </span>
                </div>
              )}

              {/* Logout */}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t("logout")}
              </button>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
