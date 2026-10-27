"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Search, ShieldCheck, UserCog } from "lucide-react";
import { useState } from "react";
import { useDebounced } from "@/components/admin/use-debounced";
import { BanDialog, ChangeRoleDialog } from "@/components/admin/user-dialogs";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Pagination,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api/client";
import { isAdmin, useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { Paginated, PublicUser, Role, UserStatus } from "@/types/api";

const s = t.admin.users;
const PAGE_SIZE = 20;
const ALL = "all";
const ROLES: Role[] = ["student", "mentor", "admin", "super_admin"];
const STATUSES: UserStatus[] = ["active", "banned"];

const roleTone = {
  student: "neutral",
  mentor: "primary",
  admin: "warning",
  super_admin: "warning",
} as const;

function UserActions({
  user,
  me,
}: {
  user: PublicUser;
  me: { id: string; role: Role } | undefined;
}) {
  if (!me) return null;
  if (user.id === me.id) {
    return <span className="text-muted-foreground text-xs">{s.you}</span>;
  }
  const isSuper = me.role === "super_admin";
  if (isAdmin(user.role) && !isSuper) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-xs">—</span>
        </TooltipTrigger>
        <TooltipContent>{s.superAdminOnly}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <ChangeRoleDialog user={user} canGrantAdmin={isSuper}>
        <Button variant="ghost" size="sm">
          <UserCog /> {s.changeRole}
        </Button>
      </ChangeRoleDialog>
      <BanDialog user={user}>
        <Button
          variant="ghost"
          size="sm"
          className={user.status === "active" ? "text-destructive" : ""}
        >
          {user.status === "active" ? <Ban /> : <ShieldCheck />}
          {user.status === "active" ? s.ban : s.unban}
        </Button>
      </BanDialog>
    </div>
  );
}

export default function AdminUsersPage() {
  const { data: meData } = useMe();
  const me = meData?.user;
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search.trim());

  const params = {
    search: debouncedSearch,
    role: role === ALL ? undefined : role,
    status: status === ALL ? undefined : status,
    page,
    pageSize: PAGE_SIZE,
  };
  const query = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => api<Paginated<PublicUser>>("/admin/users", { query: params }),
    placeholderData: keepPreviousData,
  });

  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => resetPage(setSearch)(e.target.value)}
            placeholder={s.search}
            className="pl-8"
            aria-label={s.search}
          />
        </div>
        <Select value={role} onValueChange={resetPage(setRole)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{s.allRoles}</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {t.common.roles[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={resetPage(setStatus)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{s.allStatuses}</SelectItem>
            {STATUSES.map((st) => (
              <SelectItem key={st} value={st}>
                {t.common.userStatus[st]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data || query.data.items.length === 0 ? (
        <EmptyState title={s.empty} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.user}</TableHead>
                  <TableHead>{s.columns.role}</TableHead>
                  <TableHead>{s.columns.status}</TableHead>
                  <TableHead>{s.columns.verified}</TableHead>
                  <TableHead>{s.columns.mfa}</TableHead>
                  <TableHead className="text-right">{s.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.fullName || "—"}</p>
                      <p className="text-muted-foreground text-xs">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={roleTone[u.role]}>{t.common.roles[u.role]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={u.status === "active" ? "success" : "danger"}>
                        {t.common.userStatus[u.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.emailVerified ? s.verified : s.unverified}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {u.mfaEnabled ? s.mfaOn : s.mfaOff}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions user={u} me={me} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="grid gap-3 md:hidden">
            {query.data.items.map((u) => (
              <li key={u.id} className="rounded-xl border p-4">
                <p className="font-medium">{u.fullName || "—"}</p>
                <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge tone={roleTone[u.role]}>{t.common.roles[u.role]}</StatusBadge>
                  <StatusBadge tone={u.status === "active" ? "success" : "danger"}>
                    {t.common.userStatus[u.status]}
                  </StatusBadge>
                  <StatusBadge>{u.emailVerified ? s.verified : s.unverified}</StatusBadge>
                  <StatusBadge>
                    {s.columns.mfa} {u.mfaEnabled ? s.mfaOn : s.mfaOff}
                  </StatusBadge>
                </div>
                <div className="mt-3 -ml-2">
                  <UserActions user={u} me={me} />
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.total}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
