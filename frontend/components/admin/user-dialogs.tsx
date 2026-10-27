"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { PublicUser, Role } from "@/types/api";

const s = t.admin.users;
const reason = z.string().trim().min(3, t.admin.validation.reasonMin).max(500);

const ALL_ROLES: Role[] = ["student", "mentor", "admin", "super_admin"];

export function ChangeRoleDialog({
  user,
  canGrantAdmin,
  children,
}: {
  user: PublicUser;
  canGrantAdmin: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const roles = ALL_ROLES.filter(
    (r) => r !== user.role && (canGrantAdmin || (r !== "admin" && r !== "super_admin")),
  );
  const schema = z.object({ role: z.enum(ALL_ROLES), reason });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { role: roles[0] ?? "student", reason: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<PublicUser>(`/admin/users/${user.id}/role`, { method: "PATCH", body: values }),
    onSuccess: () => {
      toast.success(s.roleDialog.done);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{s.roleDialog.title}</DialogTitle>
            <DialogDescription>{s.roleDialog.description(user.email)}</DialogDescription>
          </DialogHeader>
          <Field label={s.roleDialog.role} error={form.formState.errors.role?.message}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t.common.roles[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label={s.roleDialog.reason}
            htmlFor="role-reason"
            hint={s.roleDialog.reasonHint}
            error={form.formState.errors.reason?.message}
          >
            <Textarea id="role-reason" rows={3} {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {s.roleDialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BanDialog({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const banning = user.status === "active";
  const schema = z.object({ reason });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<PublicUser>(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: { status: banning ? "banned" : "active", reason: values.reason },
      }),
    onSuccess: () => {
      toast.success(banning ? s.banDialog.banned : s.banDialog.unbanned);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{banning ? s.banDialog.banTitle : s.banDialog.unbanTitle}</DialogTitle>
            <DialogDescription>
              {banning
                ? s.banDialog.banDescription(user.email)
                : s.banDialog.unbanDescription(user.email)}
            </DialogDescription>
          </DialogHeader>
          <Field
            label={s.banDialog.reason}
            htmlFor="ban-reason"
            hint={s.roleDialog.reasonHint}
            error={form.formState.errors.reason?.message}
          >
            <Textarea id="ban-reason" rows={3} {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button
              type="submit"
              variant={banning ? "destructive" : "default"}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Spinner />}
              {banning ? s.ban : s.unban}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
