"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, EyeOff, MessageSquareWarning, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ModerationAction, ModerationGroup } from "@/types/api";

const s = t.moderation;

type NoteAction = "hide" | "dismiss" | "restore";

function useResolve(group: ModerationGroup) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, note }: { action: ModerationAction; note: string }) =>
      api("/admin/moderation/resolve", {
        method: "POST",
        body: { targetType: group.targetType, targetId: group.targetId, action, note },
      }),
    onSuccess: async (_data, { action }) => {
      toast.success(s.done[action]);
      await queryClient.invalidateQueries({ queryKey: ["admin", "moderation"] });
    },
    onError: toastError,
  });
}

const noteSchema = z.object({ note: z.string().trim().max(1000) });

/** Hide / dismiss / restore with an optional audit note. */
function NoteDialog({
  group,
  action,
  open,
  onOpenChange,
}: {
  group: ModerationGroup;
  action: NoteAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resolve = useResolve(group);
  const form = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });
  const copy = {
    hide: [s.dialogs.hideTitle, s.dialogs.hideBody],
    dismiss: [s.dialogs.dismissTitle, s.dialogs.dismissBody],
    restore: [s.dialogs.restoreTitle, s.dialogs.restoreBody],
  }[action];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(async ({ note }) => {
            await resolve.mutateAsync({ action, note });
            form.reset();
            onOpenChange(false);
          })}
        >
          <DialogHeader>
            <DialogTitle>{copy[0]}</DialogTitle>
            <DialogDescription>{copy[1]}</DialogDescription>
          </DialogHeader>
          <Field label={s.dialogs.note} htmlFor={`note-${group.targetId}`}>
            <Textarea id={`note-${group.targetId}`} rows={3} {...form.register("note")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending && <Spinner />}
              {s.actions[action]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const warnSchema = z.object({
  note: z.string().trim().min(3, s.dialogs.messageRequired).max(1000),
  alsoHide: z.boolean(),
});

function WarnDialog({
  group,
  open,
  onOpenChange,
}: {
  group: ModerationGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const resolve = useResolve(group);
  const form = useForm<z.infer<typeof warnSchema>>({
    resolver: zodResolver(warnSchema),
    defaultValues: { note: "", alsoHide: false },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(async ({ note, alsoHide }) => {
            await resolve.mutateAsync({ action: "warn", note });
            if (alsoHide && !group.hidden) await resolve.mutateAsync({ action: "hide", note });
            form.reset();
            onOpenChange(false);
          })}
        >
          <DialogHeader>
            <DialogTitle>{s.dialogs.warnTitle}</DialogTitle>
            <DialogDescription>{s.dialogs.warnBody}</DialogDescription>
          </DialogHeader>
          <Field
            label={s.dialogs.message}
            htmlFor={`warn-${group.targetId}`}
            error={form.formState.errors.note?.message}
          >
            <Textarea
              id={`warn-${group.targetId}`}
              rows={4}
              placeholder={s.dialogs.messagePlaceholder}
              {...form.register("note")}
            />
          </Field>
          {!group.hidden && (
            <Controller
              control={form.control}
              name="alsoHide"
              render={({ field }) => (
                <Label className="flex items-center gap-2 font-normal">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                  {s.dialogs.alsoHide}
                </Label>
              )}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={resolve.isPending}>
              {resolve.isPending && <Spinner />}
              {s.actions.warn}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One reported post or answer with its reports and the moderator actions. */
export function ModerationCard({ group, open }: { group: ModerationGroup; open: boolean }) {
  const resolve = useResolve(group);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const [warning, setWarning] = useState(false);

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="primary">
            {group.targetType === "post" ? s.post : s.answer}
          </StatusBadge>
          <StatusBadge tone="warning">{s.reports(group.reports.length)}</StatusBadge>
          {group.hidden && <StatusBadge tone="neutral">{s.hidden}</StatusBadge>}
          {group.deleted && <StatusBadge tone="danger">{s.deleted}</StatusBadge>}
        </div>
        <CardTitle className="text-base">
          {group.targetType === "post" ? group.title : s.answerOn(group.title)}
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {group.author.fullName || group.author.email}
          {group.author.fullName && <span> · {group.author.email}</span>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="bg-muted/40 rounded-lg border p-3 text-sm whitespace-pre-line">
          {group.excerpt}
        </p>

        <ul className="divide-y rounded-lg border text-sm">
          {group.reports.map((r) => (
            <li key={r.id} className="space-y-1 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t.community.reportReasons[r.reason]}</span>
                {!open && (
                  <StatusBadge tone={r.status === "dismissed" ? "neutral" : "success"}>
                    {s.status[r.status]}
                    {r.action && ` · ${s.actionLabels[r.action]}`}
                  </StatusBadge>
                )}
              </div>
              {r.details && <p className="text-muted-foreground">{r.details}</p>}
              <p className="text-muted-foreground text-xs">
                {s.reportedBy(r.reporter.fullName || r.reporter.email, timeAgo(r.createdAt))}
              </p>
              {!open && r.note && <p className="text-xs italic">{r.note}</p>}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {open && !group.deleted && (
            <>
              {!group.hidden && (
                <Button size="sm" variant="outline" onClick={() => setNoteAction("hide")}>
                  <EyeOff /> {s.actions.hide}
                </Button>
              )}
              <ConfirmDialog
                title={s.dialogs.deleteTitle}
                description={s.dialogs.deleteBody}
                confirmLabel={s.actions.delete}
                destructive
                onConfirm={() => resolve.mutateAsync({ action: "delete", note: "" })}
              >
                <Button size="sm" variant="destructive">
                  <Trash2 /> {s.actions.delete}
                </Button>
              </ConfirmDialog>
              <Button size="sm" variant="outline" onClick={() => setWarning(true)}>
                <MessageSquareWarning /> {s.actions.warn}
              </Button>
            </>
          )}
          {open && (
            <Button size="sm" variant="ghost" onClick={() => setNoteAction("dismiss")}>
              <X /> {s.actions.dismiss}
            </Button>
          )}
          {group.hidden && !group.deleted && (
            <Button size="sm" variant="outline" onClick={() => setNoteAction("restore")}>
              <RotateCcw /> {s.actions.restore}
            </Button>
          )}
          {!group.deleted && (
            <Button size="sm" variant="ghost" className="sm:ml-auto" asChild>
              <Link href={`/community/posts/${group.postId}`} target="_blank" rel="noopener">
                <ExternalLink /> {s.viewPost}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>

      {noteAction && (
        <NoteDialog
          group={group}
          action={noteAction}
          open
          onOpenChange={(o) => !o && setNoteAction(null)}
        />
      )}
      <WarnDialog group={group} open={warning} onOpenChange={setWarning} />
    </Card>
  );
}
