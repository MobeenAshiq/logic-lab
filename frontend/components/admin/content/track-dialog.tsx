"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { AdminTrack } from "@/types/api";
import { type TrackForm, trackFormSchema } from "./schemas";

const s = t.adminContent.tracks;

/** Create (track = null) or edit a track. */
export function TrackDialog({
  open,
  onOpenChange,
  track,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: AdminTrack | null;
}) {
  const queryClient = useQueryClient();
  const form = useForm<TrackForm>({
    resolver: zodResolver(trackFormSchema),
    defaultValues: { title: "", slug: "", description: "", icon: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: track?.title ?? "",
        slug: track?.slug ?? "",
        description: track?.description ?? "",
        icon: track?.icon ?? "",
      });
    }
  }, [open, track, form]);

  const save = useMutation({
    mutationFn: (v: TrackForm) => {
      const body = {
        title: v.title,
        description: v.description,
        icon: v.icon || null,
        ...(v.slug ? { slug: v.slug } : {}),
      };
      return track
        ? api(`/admin/content/tracks/${track.id}`, { method: "PATCH", body })
        : api("/admin/content/tracks", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(t.adminContent.saved);
      void queryClient.invalidateQueries({ queryKey: ["admin", "tracks"] });
      onOpenChange(false);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{track ? s.edit : s.new}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4">
          <Field label={s.fields.title} htmlFor="track-title" error={errors.title?.message}>
            <Input id="track-title" {...form.register("title")} />
          </Field>
          <Field
            label={s.fields.slug}
            htmlFor="track-slug"
            error={errors.slug?.message}
            hint={s.fields.slugHint}
          >
            <Input id="track-slug" {...form.register("slug")} />
          </Field>
          <Field
            label={s.fields.description}
            htmlFor="track-desc"
            error={errors.description?.message}
          >
            <Textarea id="track-desc" rows={3} {...form.register("description")} />
          </Field>
          <Field
            label={s.fields.icon}
            htmlFor="track-icon"
            error={errors.icon?.message}
            hint={s.fields.iconHint}
          >
            <Input id="track-icon" {...form.register("icon")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t.common.actions.saving : t.common.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
