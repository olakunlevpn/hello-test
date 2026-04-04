"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Hash, UserCheck, Mail } from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface Team {
  id: string;
  displayName: string;
  description: string;
}

interface Channel {
  id: string;
  displayName: string;
  description: string;
}

interface Member {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
}

interface TeamState {
  channelsOpen: boolean;
  membersOpen: boolean;
  channels: Channel[] | null;
  members: Member[] | null;
  channelsLoading: boolean;
  membersLoading: boolean;
}

export default function TeamsPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamStates, setTeamStates] = useState<Record<string, TeamState>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccounts((data.accounts || []).filter((a: Account) => a.status === "ACTIVE"));
      })
      .catch(() => {});
  }, [status]);

  const loadTeams = async (accountId: string) => {
    setLoading(true);
    setTeams([]);
    setTeamStates({});
    setHasLoaded(false);

    try {
      const res = await fetch(`/api/teams?accountId=${accountId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        return;
      }

      const items: Team[] = data.value || [];
      setTeams(items);
      const initial: Record<string, TeamState> = {};
      for (const team of items) {
        initial[team.id] = {
          channelsOpen: false,
          membersOpen: false,
          channels: null,
          members: null,
          channelsLoading: false,
          membersLoading: false,
        };
      }
      setTeamStates(initial);
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (accountId) loadTeams(accountId);
  };

  const toggleChannels = async (teamId: string) => {
    const state = teamStates[teamId];
    if (!state) return;

    if (state.channelsOpen) {
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], channelsOpen: false },
      }));
      return;
    }

    if (state.channels !== null) {
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], channelsOpen: true },
      }));
      return;
    }

    setTeamStates((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], channelsLoading: true, channelsOpen: true },
    }));

    try {
      const res = await fetch(`/api/teams/${teamId}/channels?accountId=${selectedAccountId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        setTeamStates((prev) => ({
          ...prev,
          [teamId]: { ...prev[teamId], channelsLoading: false, channelsOpen: false },
        }));
        return;
      }

      setTeamStates((prev) => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          channels: data.value || [],
          channelsLoading: false,
        },
      }));
    } catch {
      toast.error(t("error"));
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], channelsLoading: false, channelsOpen: false },
      }));
    }
  };

  const toggleMembers = async (teamId: string) => {
    const state = teamStates[teamId];
    if (!state) return;

    if (state.membersOpen) {
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], membersOpen: false },
      }));
      return;
    }

    if (state.members !== null) {
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], membersOpen: true },
      }));
      return;
    }

    setTeamStates((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], membersLoading: true, membersOpen: true },
    }));

    try {
      const res = await fetch(`/api/teams/${teamId}/members?accountId=${selectedAccountId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        setTeamStates((prev) => ({
          ...prev,
          [teamId]: { ...prev[teamId], membersLoading: false, membersOpen: false },
        }));
        return;
      }

      setTeamStates((prev) => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          members: data.value || [],
          membersLoading: false,
        },
      }));
    } catch {
      toast.error(t("error"));
      setTeamStates((prev) => ({
        ...prev,
        [teamId]: { ...prev[teamId], membersLoading: false, membersOpen: false },
      }));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Users className="h-7 w-7" />
        {t("teams")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("teams")}</CardTitle>
          <CardDescription>{t("teamsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t("accounts")}
              </label>
              <Select value={selectedAccountId} onValueChange={(v) => v && handleAccountChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>
                    {t("selectAccount")}
                  </SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {a.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingText className="text-muted-foreground" />
        </div>
      )}

      {!loading && hasLoaded && teams.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("teams")}</h2>
            <Badge variant="secondary">
              {t("teamsTotal", { count: String(teams.length) })}
            </Badge>
          </div>

          {teams.map((team) => {
            const state = teamStates[team.id];
            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{team.displayName}</CardTitle>
                      {team.description && (
                        <CardDescription className="mt-1">{team.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleChannels(team.id)}
                        disabled={state?.channelsLoading}
                      >
                        <Hash className="mr-1 h-3 w-3" />
                        {t("teamsChannels")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMembers(team.id)}
                        disabled={state?.membersLoading}
                      >
                        <UserCheck className="mr-1 h-3 w-3" />
                        {t("teamsMembers")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {state?.channelsOpen && (
                  <CardContent className="pt-0">
                    <div className="border rounded-md p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {t("teamsChannels")}
                      </p>
                      {state.channelsLoading ? (
                        <LoadingText className="text-sm text-muted-foreground" />
                      ) : state.channels && state.channels.length > 0 ? (
                        <ul className="space-y-1">
                          {state.channels.map((ch) => (
                            <li key={ch.id} className="text-sm flex items-center gap-2">
                              <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-medium">{ch.displayName}</span>
                              {ch.description && (
                                <span className="text-muted-foreground truncate">{ch.description}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("teamsNoChannels")}</p>
                      )}
                    </div>
                  </CardContent>
                )}

                {state?.membersOpen && (
                  <CardContent className="pt-0">
                    <div className="border rounded-md p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {t("teamsMembers")}
                      </p>
                      {state.membersLoading ? (
                        <LoadingText className="text-sm text-muted-foreground" />
                      ) : state.members && state.members.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("name")}</TableHead>
                                <TableHead>{t("email")}</TableHead>
                                <TableHead>{t("teamsRole")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {state.members.map((member) => (
                                <TableRow key={member.id}>
                                  <TableCell className="text-sm font-medium">
                                    {member.displayName || "—"}
                                  </TableCell>
                                  <TableCell className="text-sm font-mono">
                                    {member.email || "—"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {member.roles && member.roles.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {member.roles.map((r) => (
                                          <Badge key={r} variant="secondary" className="text-xs">
                                            {r}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("teamsNoMembers")}</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!loading && hasLoaded && teams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("teamsNoTeams")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
