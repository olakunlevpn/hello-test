import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { prisma } from "./prisma";
import { verifyPassword } from "./password";
import { MicrosoftGraphService } from "./microsoft-graph";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Block suspended/blocked users from logging in
        if (user.status === "SUSPENDED" || user.status === "BLOCKED") return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      // Refresh role + status + subscription from DB in a single query
      if (token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            select: {
              role: true,
              status: true,
              subscription: { select: { status: true, currentPeriodEnd: true } },
            },
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.status = dbUser.status;
            token.hasActiveSubscription =
              dbUser.subscription?.status === "ACTIVE" &&
              dbUser.subscription.currentPeriodEnd > new Date();
          }
        } catch {
          // DB query failed — keep existing token values
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        (session.user as any).role = token.role as string;
        (session.user as any).hasActiveSubscription = token.hasActiveSubscription as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string })?.id ?? null;
}

export async function getUserRole(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string })?.role ?? null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error("UNAUTHORIZED");
  return userId;
}

export async function requireAdmin(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) throw new Error("UNAUTHORIZED");
  if (role !== "ADMIN") throw new Error("FORBIDDEN");
  return userId;
}

export async function requireActiveSubscription(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  if (!userId) throw new Error("UNAUTHORIZED");

  // Admins bypass subscription check
  if (role === "ADMIN") return userId;

  // Use subscription status from JWT (already refreshed from DB in jwt callback)
  if (!hasActiveSubscription) {
    throw new Error("SUBSCRIPTION_REQUIRED");
  }

  return userId;
}

export async function getGraphServiceForUser(
  accountId: string,
  userId: string
): Promise<MicrosoftGraphService> {
  const account = await prisma.linkedAccount.findFirst({
    where: { id: accountId, userId, status: "ACTIVE" },
  });

  if (!account) throw new Error("ACCOUNT_NOT_FOUND");

  return new MicrosoftGraphService(account);
}
