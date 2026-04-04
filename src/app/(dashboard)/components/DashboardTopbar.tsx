"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Shield, Menu } from "lucide-react";
import { t } from "@/i18n";

interface DashboardTopbarProps {
  onMenuToggle?: () => void;
}

export default function DashboardTopbar({ onMenuToggle }: DashboardTopbarProps) {
  const { data: session } = useSession();
  const userName = session?.user?.name || session?.user?.email || "";
  const role = (session?.user as { role?: string })?.role;
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <button onClick={onMenuToggle} className="md:hidden p-2 rounded hover:bg-muted">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:inline">{userName}</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {role === "ADMIN" && (
            <DropdownMenuItem
              render={<a href="/admin" />}
            >
              <Shield className="mr-2 h-4 w-4" />
              {t("adminDashboard")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            render={<a href="/dashboard/settings" />}
          >
            <User className="mr-2 h-4 w-4" />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
