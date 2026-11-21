"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/student/progress";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import type { AdminTrack } from "@/types/api";

interface Job {
  status: "running" | "done" | "failed" | "unknown";
  modulesDone?: number;
  modulesTotal?: number;
  problems?: string[];
}

const EXAMPLE =
  "Teach Python from zero for university students in Pakistan: variables, conditions, loops, functions, lists and dictionaries, files, and finish with a small project that saves student marks to a file.";

export default function GenerateCoursePage() {
  const [prompt, setPrompt] = useState("");
  const [trackId, setTrackId] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);

  const tracks = useQuery({
    queryKey: ["admin", "tracks"],
    queryFn: () => api<AdminTrack[]>("/admin/content/tracks"),
  });

  const start = useMutation({
    mutationFn: () =>
      api<{ courseId: string }>("/admin/course-generator", {
        method: "POST",
        body: { prompt, trackId: trackId || undefined },
      }),
    onSuccess: (res) => setCourseId(res.courseId),
    onError: toastError,
  });

  const job = useQuery({
    queryKey: ["admin", "course-generator", courseId],
    queryFn: () => api<Job>(`/admin/course-generator/${courseId}`),
    enabled: !!courseId,
    // Poll while the modules are being written.
    refetchInterval: (q) => (q.state.data?.status === "running" ? 3000 : false),
  });

  const j = job.data;
  const percent = j?.modulesTotal ? Math.round(((j.modulesDone ?? 0) / j.modulesTotal) * 100) : 0;

  return (
    <div className="max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/content">
          <ArrowLeft /> Back to content
        </Link>
      </Button>
      <PageHeader
        title="Generate a course with AI"
        description="Describe the course in one paragraph. The AI writes a track, course, modules from basic to advanced, lectures with examples and tasks, a quiz and a code assignment per module, and a final project. Everything is saved as unpublished drafts for you to review."
      />

      {!courseId ? (
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <Field label="What should the course teach?" htmlFor="gen-prompt" hint="Who it is for, what they learn, and the final project.">
              <Textarea
                id="gen-prompt"
                rows={6}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE}
              />
            </Field>
            <Field label="Track" htmlFor="gen-track">
              <select
                id="gen-track"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className="border-input bg-background h-9 rounded-[4px] border px-2 text-sm"
              >
                <option value="">Create a new track</option>
                {(tracks.data ?? []).map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    Add to: {tr.title}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              onClick={() => start.mutate()}
              disabled={start.isPending || prompt.trim().length < 20}
              className="justify-self-start"
            >
              {start.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {start.isPending ? "Planning the course…" : "Generate course"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {j?.status === "done"
                ? "Course ready for review"
                : j?.status === "failed"
                  ? "Generation stopped"
                  : j?.status === "unknown"
                    ? "Progress not available"
                    : "Writing the course…"}
            </CardTitle>
            <CardDescription>
              {j?.status === "unknown"
                ? "The server restarted during generation. Open the course to see what was saved."
                : `Module ${j?.modulesDone ?? 0} of ${j?.modulesTotal ?? "?"} written. This takes a few minutes; you can leave this page.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Progress value={percent} />
            {(j?.problems?.length ?? 0) > 0 && (
              <div className="text-sm">
                <p className="font-medium">Some parts could not be written. They are left as empty drafts to fill in by hand:</p>
                <ul className="text-muted-foreground mt-1 list-disc pl-5">
                  {j?.problems?.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>
            )}
            <Button asChild className="justify-self-start">
              <Link href={`/admin/content/courses/${courseId}`}>
                Open in course editor <ArrowRight />
              </Link>
            </Button>
            <p className="text-muted-foreground text-xs">
              Nothing is visible to students until you publish the course, its modules and lessons. Assign a mentor in the course editor so they can review it too.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
