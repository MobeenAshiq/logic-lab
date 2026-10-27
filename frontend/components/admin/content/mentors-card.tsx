"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { AdminCourse, Paginated, PublicUser } from "@/types/api";

const s = t.adminContent.mentors;

export function MentorsCard({ course }: { course: AdminCourse }) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState("");

  const mentors = useQuery({
    queryKey: ["admin", "users", { role: "mentor", pageSize: 100 }],
    queryFn: () =>
      api<Paginated<PublicUser>>("/admin/users", { query: { role: "mentor", pageSize: 100 } }),
  });

  const assignedIds = new Set(course.mentors.map((m) => m.id));
  const available = (mentors.data?.items ?? []).filter((m) => !assignedIds.has(m.id));

  const update = (data: AdminCourse) => {
    queryClient.setQueryData(["admin", "course", course.id], data);
    void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
  };

  const assign = useMutation({
    mutationFn: (mentorId: string) =>
      api<AdminCourse>(`/admin/content/courses/${course.id}/mentors`, {
        method: "POST",
        body: { mentorId },
      }),
    onSuccess: (data) => {
      update(data);
      setChoice("");
      toast.success(s.assigned);
    },
    onError: toastError,
  });

  async function remove(mentorId: string) {
    try {
      const data = await api<AdminCourse>(
        `/admin/content/courses/${course.id}/mentors/${mentorId}`,
        { method: "DELETE" },
      );
      update(data);
      toast.success(s.removed);
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{s.heading}</CardTitle>
        <CardDescription>{s.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {course.mentors.length === 0 ? (
          <p className="text-muted-foreground text-sm">{s.empty}</p>
        ) : (
          <ul className="grid gap-2">
            {course.mentors.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.fullName || m.email}</p>
                  <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                </div>
                <ConfirmDialog
                  title={s.removeTitle}
                  confirmLabel={t.common.actions.remove}
                  destructive
                  onConfirm={() => remove(m.id)}
                >
                  <Button variant="ghost" size="icon-sm" aria-label={t.common.actions.remove}>
                    <UserMinus />
                  </Button>
                </ConfirmDialog>
              </li>
            ))}
          </ul>
        )}

        {mentors.isSuccess && available.length === 0 ? (
          <p className="text-muted-foreground text-xs">{s.noneAvailable}</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="w-full" disabled={!mentors.isSuccess}>
                <SelectValue placeholder={s.choose} />
              </SelectTrigger>
              <SelectContent>
                {available.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName ? `${m.fullName} (${m.email})` : m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!choice || assign.isPending}
              onClick={() => assign.mutate(choice)}
            >
              <UserPlus /> {s.add}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
