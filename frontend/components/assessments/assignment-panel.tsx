"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WriteOnlyEditor } from "@/components/assessments/write-only-editor";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingRows, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { formatDateTime, timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import { learningKeys } from "@/lib/learning";
import type { AssignmentInfo, TypingEvent } from "@/types/api";

const ta = t.assessments.assignment;
const AUTOSAVE_MS = 15_000;

const assignmentKey = (lessonId: string) => ["learn", "assignment", lessonId] as const;

/** Assignment instructions, rubric, the write-only answer box and the returned grade. */
export function AssignmentPanel({
  lessonId,
  courseSlug,
  isStaff,
}: {
  lessonId: string;
  courseSlug: string;
  isStaff: boolean;
}) {
  const info = useQuery({
    queryKey: assignmentKey(lessonId),
    queryFn: () => api<AssignmentInfo>(`/learn/lessons/${lessonId}/assignment`),
  });
  if (info.isLoading) return <LoadingRows rows={4} />;
  if (!info.data) return null;
  const a = info.data;
  const sub = a.submission;
  const overdue = a.dueAt && Date.parse(a.dueAt) < Date.parse(a.serverNow);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {ta.instructions}
            <span className="text-muted-foreground text-sm font-normal">
              {ta.maxMarks(a.maxMarks)}
            </span>
          </CardTitle>
          {a.dueAt && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CalendarClock className="size-4" /> {ta.due(formatDateTime(a.dueAt))}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {a.instructions && (
            <p className="text-sm leading-7 whitespace-pre-line">{a.instructions}</p>
          )}
          {a.rubric.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">{ta.rubric}</p>
              <ul className="divide-y rounded-lg border text-sm">
                {a.rubric.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      {c.description && (
                        <p className="text-muted-foreground text-xs">{c.description}</p>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {sub?.status === "returned"
                        ? ta.grade(sub.rubricScores[c.id] ?? 0, c.maxPoints)
                        : c.maxPoints}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {isStaff ? (
        <p className="text-muted-foreground text-sm">{t.learning.lesson.preview}</p>
      ) : !sub || sub.status === "draft" ? (
        <>
          {overdue && (
            <Alert>
              <AlertTriangle />
              <AlertDescription>{ta.overdue}</AlertDescription>
            </Alert>
          )}
          <DraftEditor lessonId={lessonId} courseSlug={courseSlug} initial={sub?.content ?? ""} />
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {ta.yourAnswer}
              {sub.status === "returned" ? (
                <StatusBadge tone="success">
                  <CheckCircle2 className="size-3" /> {ta.returned}
                </StatusBadge>
              ) : (
                <StatusBadge tone="warning">{ta.waiting}</StatusBadge>
              )}
              {sub.late && <StatusBadge tone="danger">{ta.late}</StatusBadge>}
            </CardTitle>
            {sub.submittedAt && (
              <p className="text-muted-foreground text-sm">
                {ta.submittedAt(formatDateTime(sub.submittedAt))}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {sub.status === "returned" && sub.grade !== null && (
              <p className="text-2xl font-semibold">{ta.grade(sub.grade, a.maxMarks)}</p>
            )}
            {sub.status === "returned" && sub.feedback && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <p className="mb-1 font-medium">{ta.feedback}</p>
                <p className="whitespace-pre-line">{sub.feedback}</p>
              </div>
            )}
            <pre className="bg-muted/40 max-h-96 overflow-auto rounded-lg border p-3 font-sans text-sm whitespace-pre-wrap">
              {sub.content}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DraftEditor({
  lessonId,
  courseSlug,
  initial,
}: {
  lessonId: string;
  courseSlug: string;
  initial: string;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initial);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const lastSaved = useRef(initial);
  const contentRef = useRef(content);
  contentRef.current = content;

  const saveDraft = useCallback(async () => {
    const value = contentRef.current;
    if (value === lastSaved.current) return;
    try {
      const res = await api<{ savedAt: string }>(`/learn/lessons/${lessonId}/assignment/draft`, {
        method: "PUT",
        body: { content: value },
      });
      lastSaved.current = value;
      setSavedAt(res.savedAt);
    } catch (err) {
      toastError(err);
    }
  }, [lessonId]);

  // Autosave every 15 s and when leaving the page.
  useEffect(() => {
    const timer = setInterval(() => void saveDraft(), AUTOSAVE_MS);
    return () => {
      clearInterval(timer);
      void saveDraft();
    };
  }, [saveDraft]);

  const sendTyping = useCallback(
    async (events: TypingEvent[]) => {
      await api(`/learn/lessons/${lessonId}/assignment/typing`, {
        method: "POST",
        body: { events },
      }).catch(() => {});
    },
    [lessonId],
  );

  const submit = useMutation({
    mutationFn: () =>
      api<AssignmentInfo>(`/learn/lessons/${lessonId}/assignment/submit`, {
        method: "POST",
        body: { content: contentRef.current },
      }),
    onSuccess: (data) => {
      lastSaved.current = contentRef.current;
      queryClient.setQueryData(assignmentKey(lessonId), data);
      void queryClient.invalidateQueries({ queryKey: learningKeys.outline(courseSlug) });
      toast.success(ta.submitted);
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ta.yourAnswer}</CardTitle>
        <p className="text-muted-foreground text-xs">
          {savedAt ? t.assessments.editor.saved(timeAgo(savedAt)) : null}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <WriteOnlyEditor
          value={content}
          onChange={setContent}
          onEvents={sendTyping}
          placeholder={ta.placeholder}
          rows={14}
          maxLength={50_000}
          aria-label={ta.yourAnswer}
        />
        <ConfirmDialog
          title={ta.submit}
          description={ta.submitConfirm}
          confirmLabel={ta.submit}
          onConfirm={async () => {
            if (!contentRef.current.trim()) {
              toast.error(ta.empty);
              return;
            }
            await submit.mutateAsync();
          }}
        >
          <Button disabled={submit.isPending || !content.trim()}>{ta.submit}</Button>
        </ConfirmDialog>
      </CardContent>
    </Card>
  );
}
