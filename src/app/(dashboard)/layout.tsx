"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardSidebar from "./components/DashboardSidebar";
import DashboardTopbar from "./components/DashboardTopbar";
import { LoadingText } from "@/components/ui/loading-text";

const publicPaths = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];
const subscriptionFreePaths = ["/dashboard/billing", "/dashboard/tools", "/dashboard/settings"];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const isPublic = publicPaths.includes(pathname);
  const isSubscriptionFree = subscriptionFreePaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const role = (session?.user as { role?: string })?.role;
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;

  useEffect(() => {
    // Reset redirecting when we arrive at the target page
    setRedirecting(false);

    if (isPublic || status === "loading") return;

    if (status === "unauthenticated") {
      setRedirecting(true);
      router.replace("/login");
      return;
    }

    // Subscription gate — admins bypass
    if (
      status === "authenticated" &&
      !isSubscriptionFree &&
      !hasActiveSubscription &&
      role !== "ADMIN"
    ) {
      setRedirecting(true);
      router.replace("/dashboard/billing");
    }
  }, [status, isPublic, isSubscriptionFree, hasActiveSubscription, role, router, pathname]);

  // Public pages — render immediately
  if (isPublic) {
    return <>{children}</>;
  }

  // Show nothing while loading session or redirecting
  if (status === "loading" || status === "unauthenticated" || redirecting) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardTopbar onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <AuthGate>{children}</AuthGate>
    </SessionProvider>
  );
}
