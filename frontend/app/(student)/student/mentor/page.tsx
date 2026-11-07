"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChatPanel } from "@/components/ai-mentor/chat-panel";
import { CodePanel } from "@/components/ai-mentor/code-panel";
import { RoadmapPanel } from "@/components/ai-mentor/roadmap-panel";
import { ErrorState, PageHeader } from "@/components/shared";
import { ApiError, api } from "@/lib/api/client";
import {
  extractCode,
  type MentorMessage,
  type MentorSession,
  type MentorUsage,
  type SendResult,
  type StackType,
} from "@/lib/ai-mentor";
import { toastError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { CourseOutline, LearningDashboard } from "@/types/api";

const SESSIONS_KEY = ["mentor-ai", "sessions"] as const;
const USAGE_KEY = ["mentor-ai", "usage"] as const;
const sessionKey = (id: string | null) => ["mentor-ai", "session", id] as const;

type View = "roadmap" | "chat" | "code";
type SessionDetail = MentorSession & { messages: MentorMessage[] };

export default function MentorPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialised, setInitialised] = useState(false);
  /** Scope for a chat that has not been created yet. */
  const [draftScope, setDraftScope] = useState<{ courseSlug: string | null; moduleId: string | null; stack: StackType }>({
    courseSlug: null,
    moduleId: null,
    stack: "general",
  });
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [codeId, setCodeId] = useState<string | null>(null);
  const [view, setView] = useState<View>("chat");

  const dashboard = useQuery({ queryKey: ["student", "learning"], queryFn: () => api<LearningDashboard>("/student/learning") });
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api<MentorSession[]>("/mentor-ai/sessions") });
  const usage = useQuery({ queryKey: USAGE_KEY, queryFn: () => api<MentorUsage>("/mentor-ai/usage") });
  const detail = useQuery({
    queryKey: sessionKey(activeId),
    queryFn: () => api<SessionDetail>(`/mentor-ai/sessions/${activeId}`),
    enabled: !!activeId,
  });

  // Open the most recent chat, or default a new chat to the student's first course.
  useEffect(() => {
    if (initialised || !sessions.data || !dashboard.data) return;
    setInitialised(true);
    if (sessions.data[0]) setActiveId(sessions.data[0].id);
    else setDraftScope((s) => ({ ...s, courseSlug: dashboard.data.courses[0]?.slug ?? null }));
  }, [initialised, sessions.data, dashboard.data]);

  const active = activeId ? (detail.data ?? sessions.data?.find((s) => s.id === activeId) ?? null) : null;
  const courseSlug = active ? (active.course?.slug ?? null) : draftScope.courseSlug;
  const moduleId = active ? active.moduleId : draftScope.moduleId;
  const stack = active ? active.stackType : draftScope.stack;
  const messages = useMemo(() => detail.data?.messages ?? [], [detail.data]);
  const courseTitle = active?.course?.title ?? dashboard.data?.courses.find((c) => c.slug === courseSlug)?.title;
  const outline = useQuery({
    queryKey: ["learn", "course", courseSlug],
    queryFn: () => api<CourseOutline>(`/learn/courses/${courseSlug}`),
    enabled: !!courseSlug,
  });
  const moduleTitle = active?.module?.title ?? outline.data?.modules.find((m) => m.id === moduleId)?.title;
  const scopeLabel = courseTitle ? `${courseTitle}${moduleTitle ? ` › ${moduleTitle}` : " (whole course)"}` : "General help (no course selected)";

  const blocks = useMemo(
    () => messages.filter((m) => m.senderType === "assistant" && m.flagStatus === "none").flatMap((m) => extractCode(m.id, m.content)),
    [messages],
  );

  const updateSession = useMutation({
    mutationFn: (body: { courseId?: string | null; moduleId?: string | null; stackType?: StackType }) =>
      api<MentorSession>(`/mentor-ai/sessions/${activeId}`, { method: "PATCH", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: sessionKey(activeId) });
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
    onError: toastError,
  });

  const courseIdFor = (slug: string | null) => (slug ? (dashboard.data?.courses.find((c) => c.slug === slug)?.courseId ?? null) : null);

  const changeCourse = (slug: string | null) => {
    if (activeId) updateSession.mutate({ courseId: courseIdFor(slug), moduleId: null });
    else setDraftScope((s) => ({ ...s, courseSlug: slug, moduleId: null }));
  };
  const changeModule = (_outline: CourseOutline, id: string | null) => {
    if (activeId) updateSession.mutate({ moduleId: id });
    else setDraftScope((s) => ({ ...s, moduleId: id }));
    setView("chat");
  };
  const changeStack = (next: StackType) => {
    if (activeId) updateSession.mutate({ stackType: next });
    else setDraftScope((s) => ({ ...s, stack: next }));
  };

  const send = useMutation({
    mutationFn: async (content: string) => {
      let id = activeId;
      if (!id) {
        const created = await api<MentorSession>("/mentor-ai/sessions", {
          method: "POST",
          body: { courseId: courseIdFor(draftScope.courseSlug), moduleId: draftScope.moduleId, stackType: draftScope.stack },
        });
        id = created.id;
        setActiveId(id);
      }
      const result = await api<SendResult>(`/mentor-ai/sessions/${id}/messages`, { method: "POST", body: { content } });
      return { id, result };
    },
    onMutate: (content) => {
      setPending(content);
      setDraft("");
    },
    onSuccess: async ({ id, result }) => {
      queryClient.setQueryData(USAGE_KEY, result.usage);
      if (result.flagged) toast.message("That question is outside what the mentor can help with.");
      await queryClient.invalidateQueries({ queryKey: sessionKey(id) });
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
      const code = extractCode(result.message.id, result.message.content);
      if (code.length) setCodeId(code[code.length - 1].id);
    },
    onError: (error, content) => {
      setDraft(content);
      if (error instanceof ApiError && error.code === "AI_DAILY_LIMIT_REACHED") void queryClient.invalidateQueries({ queryKey: USAGE_KEY });
      toastError(error);
    },
    onSettled: () => setPending(null),
  });

  const submit = (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || send.isPending) return;
    send.mutate(content);
  };

  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;

  return (
    <>
      <PageHeader title="AI Mentor" description="Step-by-step help with code, concepts, and your module, from analogy to implementation." />
      <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1 xl:hidden" role="tablist" aria-label="Mentor panels">
        {(["roadmap", "chat", "code"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn("flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize", v === "roadmap" && "lg:hidden", view === v ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            {v === "code" ? `Code${blocks.length ? ` (${blocks.length})` : ""}` : v}
          </button>
        ))}
      </div>
      <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <div className={cn("min-h-0", view === "roadmap" ? "flex" : "hidden lg:flex", "[&>*]:flex-1")}>
          <RoadmapPanel courseSlug={courseSlug} moduleId={moduleId} onCourseChange={changeCourse} onModuleChange={changeModule} />
        </div>
        <div className={cn("min-h-0", view === "chat" ? "flex" : view === "roadmap" ? "hidden lg:flex" : "hidden xl:flex", "[&>*]:flex-1")}>
          <ChatPanel
            sessions={sessions.data ?? []}
            activeId={activeId}
            onSelectSession={(id) => {
              setActiveId(id);
              setCodeId(null);
              if (!id) setDraftScope((s) => ({ ...s, courseSlug, moduleId }));
            }}
            stack={stack}
            onStackChange={changeStack}
            scopeLabel={scopeLabel}
            messages={messages}
            loading={!!activeId && detail.isLoading}
            pending={pending}
            draft={draft}
            onDraftChange={setDraft}
            onSend={submit}
            usage={usage.data}
            onOpenCode={(id) => {
              setCodeId(id);
              setView("code");
            }}
          />
        </div>
        <div className={cn("min-h-0", view === "code" ? "flex" : "hidden xl:flex", "[&>*]:flex-1")}>
          <CodePanel blocks={blocks} selectedId={codeId} onSelect={setCodeId} />
        </div>
      </div>
    </>
  );
}
