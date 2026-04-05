"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Link2,
  Settings,
  ArrowLeft,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "adminDashboard" as const },
  { href: "/admin/users", icon: Users, label: "adminUsers" as const },
  { href: "/admin/payments", icon: CreditCard, label: "adminPayments" as const },
  { href: "/admin/accounts", icon: Link2, label: "adminAccounts" as const },
  { href: "/admin/domains", icon: Globe, label: "customDomains" as const },
  { href: "/admin/settings", icon: Settings, label: "adminSettings" as const },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-6">
        <span className="text-lg font-bold text-red-500">{t("appName")} Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")} {t("dashboard")}
        </Link>
      </div>
    </aside>
  );
}
