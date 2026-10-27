"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { AdminCourse } from "@/types/api";
import { LEVELS, type NewCourseForm, newCourseSchema } from "./schemas";

export function NewCourseDialog({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<NewCourseForm>({
    resolver: zodResolver(newCourseSchema),
    defaultValues: { title: "", level: "beginner", shortDescription: "" },
  });

  const create = useMutation({
    mutationFn: (v: NewCourseForm) =>
      api<AdminCourse>("/admin/content/courses", { method: "POST", body: { ...v, trackId } }),
    onSuccess: (course) => {
      toast.success(t.adminContent.courses.created);
      void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tracks"] });
      setOpen(false);
      form.reset();
      router.push(`/admin/content/courses/${course.id}`);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const f = t.adminContent.course.fields;
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> {t.adminContent.courses.new}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.adminContent.courses.new}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-4">
          <Field label={f.title} htmlFor="course-title" error={errors.title?.message}>
            <Input id="course-title" {...form.register("title")} />
          </Field>
          <Field label={f.level} error={errors.level?.message}>
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {t.common.levels[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label={f.shortDescription}
            htmlFor="course-short"
            error={errors.shortDescription?.message}
            hint={f.shortDescriptionHint}
          >
            <Textarea id="course-short" rows={3} {...form.register("shortDescription")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t.common.actions.saving : t.common.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
