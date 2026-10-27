"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
import type { Conversation, PublicCourse } from "@/types/api";

interface StudentProgressData {
  courses: {
    course: { id: string; title: string; slug: string };
    totalLessons: number;
    completedLessons: number;
  }[];
}

export function OpenDoubtDialog({
  defaultCourseId,
  trigger,
}: {
  defaultCourseId?: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState(defaultCourseId || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<{
    file: File;
    preview: string;
    key?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch student's courses
  const { data: learningData } = useQuery({
    queryKey: ["student-learning"],
    queryFn: () => api<StudentProgressData>("/student/learning"),
  });

  // Also fallback to all published courses if learning courses is empty
  const { data: allCourses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api<PublicCourse[]>("/courses"),
    enabled: (learningData?.courses?.length ?? 0) === 0,
  });

  const coursesList =
    learningData?.courses && learningData.courses.length > 0
      ? learningData.courses.map((c) => ({
          id: c.course.id,
          title: c.course.title,
        }))
      : allCourses.map((c) => ({ id: c.id, title: c.title }));

  const openMutation = useMutation({
    mutationFn: (data: {
      courseId: string;
      subject: string;
      body: string;
      attachmentKey?: string | null;
    }) => api<Conversation>("/chat/conversations", { method: "POST", body: data }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      toast.success("Doubt opened! Redirecting to conversation...");
      router.push(`/student/doubts/${conv.id}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not open doubt");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG and WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
      return;
    }

    const preview = URL.createObjectURL(file);
    setAttachment({ file, preview });

    try {
      setUploading(true);
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/chat/uploads",
        {
          method: "POST",
          body: { contentType: file.type, size: file.size },
        },
      );

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) throw new Error("Upload to storage failed");
      setAttachment({ file, preview, key });
    } catch {
      toast.error("Failed to upload screenshot. Please try again.");
      setAttachment(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      toast.error("Please select a course.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }
    if (!body.trim()) {
      toast.error("Please explain your question.");
      return;
    }
    if (uploading) {
      toast.info("Please wait for screenshot upload to complete.");
      return;
    }

    openMutation.mutate({
      courseId,
      subject: subject.trim(),
      body: body.trim(),
      attachmentKey: attachment?.key ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-1.5 shadow-sm">
            <Plus className="size-4" />
            {t.realtime.chat.openDoubt}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.realtime.chat.openDoubtTitle}</DialogTitle>
          <DialogDescription>
            {t.realtime.chat.openDoubtDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t.realtime.chat.courseSelect}</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {coursesList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.realtime.chat.subject}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.realtime.chat.subjectPlaceholder}
              maxLength={120}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.realtime.chat.message}</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t.realtime.chat.messagePlaceholder}
              rows={4}
              required
            />
          </div>

          {/* Screenshot attachment */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            {attachment ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.preview}
                  alt="Preview"
                  className="size-10 rounded object-cover"
                />
                <span className="text-xs truncate flex-1">{attachment.file.name}</span>
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 rounded-full"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs text-muted-foreground"
              >
                <ImageIcon className="size-3.5" />
                Attach Code Screenshot (Optional)
              </Button>
            )}
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
            <Button
              type="submit"
              size="sm"
              disabled={openMutation.isPending || uploading}
            >
              {openMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <HelpCircle className="size-4 mr-1.5" />
              )}
              {t.realtime.chat.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
