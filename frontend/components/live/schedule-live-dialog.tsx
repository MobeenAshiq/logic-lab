"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, Loader2, Plus, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { LiveSession, MentorAssignedCourse } from "@/types/api";

export function ScheduleLiveDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("60");

  const { data: courses = [] } = useQuery({
    queryKey: ["teach-courses"],
    queryFn: () => api<MentorAssignedCourse[]>("/teach/courses"),
  });

  const scheduleMutation = useMutation({
    mutationFn: (body: {
      courseId: string;
      title: string;
      description?: string;
      startsAt: string;
      durationMinutes: number;
    }) =>
      api<LiveSession>("/teach/live-sessions", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor-live-sessions"] });
      toast.success("Live session scheduled successfully!");
      setOpen(false);
      setTitle("");
      setDescription("");
      setStartsAt("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to schedule session");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      toast.error("Please select a course.");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a session title.");
      return;
    }
    if (!startsAt) {
      toast.error("Please choose a start time.");
      return;
    }

    const isoStartsAt = new Date(startsAt).toISOString();

    scheduleMutation.mutate({
      courseId,
      title: title.trim(),
      description: description.trim(),
      startsAt: isoStartsAt,
      durationMinutes: parseInt(duration, 10) || 60,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            {t.live.scheduleNew}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.live.scheduleTitle}</DialogTitle>
          <DialogDescription>{t.live.scheduleDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t.live.course}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select course you teach" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.live.sessionTitle}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.live.sessionTitlePlaceholder}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.live.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.live.descriptionPlaceholder}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.live.startsAt}</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.live.duration}</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Calendar className="size-4 mr-1.5" />
              )}
              {t.live.scheduleSubmit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
