"use client";

import { useMutation } from "@tanstack/react-query";
import { Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";

type DraftQuestion = {
  type: "short" | "mcq";
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  explanation: string;
  sampleAnswer: string;
  tags: string[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
};

export function AiQuestionDrafts({ lessonId, courseId }: { lessonId: string; courseId: string }) {
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const generate = useMutation({
    mutationFn: () => api<{ questions: DraftQuestion[] }>(`/teach/lessons/${lessonId}/ai/questions`, { method: "POST" }),
    onSuccess: ({ questions }) => { setDrafts(questions); toast.success("Draft questions generated. Review each before adding it to the bank."); },
    onError: toastError,
  });

  const save = async (index: number) => {
    const draft = drafts[index];
    try {
      await api(`/teach/courses/${courseId}/questions`, {
        method: "POST",
        body: {
          ...draft,
          allowMultiple: false,
          codeLanguage: null,
          points: 1,
        },
      });
      setDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index));
      toast.success("Reviewed question added to the question bank.");
    } catch (error) { toastError(error); }
  };

  const edit = (index: number, patch: Partial<DraftQuestion>) => setDrafts((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><WandSparkles className="size-4 text-primary" /> AI quiz-question drafts</CardTitle>
        <CardDescription>Generate draft questions from this lesson. Review and edit before saving to the course question bank.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" disabled={generate.isPending} onClick={() => generate.mutate()}><Sparkles className="mr-2 size-4" />{generate.isPending ? "Generating…" : "Generate questions"}</Button>
        {drafts.map((draft, index) => <div key={`${index}-${draft.prompt.slice(0, 20)}`} className="space-y-3 rounded-lg border p-4">
          <label className="block space-y-1 text-sm font-medium">{draft.type === "mcq" ? "Multiple-choice question" : "Short-answer question"}
            <Textarea value={draft.prompt} rows={3} onChange={(event) => edit(index, { prompt: event.target.value })} aria-label={`Draft question ${index + 1}`} />
          </label>
          {draft.type === "mcq" ? <div className="space-y-2">{draft.options.map((option, optionIndex) => <label key={option.id} className="flex items-center gap-2 text-sm"><input type="radio" name={`correct-${index}`} checked={draft.correctOptionIds.includes(option.id)} onChange={() => edit(index, { correctOptionIds: [option.id] })} aria-label={`Mark option ${optionIndex + 1} correct`} /><Input value={option.text} onChange={(event) => edit(index, { options: draft.options.map((item) => item.id === option.id ? { ...item, text: event.target.value } : item) })} aria-label={`Option ${optionIndex + 1}`} /></label>)}</div> : <label className="block space-y-1 text-sm font-medium">Reference answer<textarea className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm" value={draft.sampleAnswer} rows={3} onChange={(event) => edit(index, { sampleAnswer: event.target.value })} /></label>}
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-muted-foreground text-xs">Suggested topic tags: {draft.tags.join(", ") || "none"} · verify correctness before saving.</p><Button size="sm" disabled={draft.prompt.trim().length < 3 || (draft.type === "mcq" && (draft.options.some((option) => !option.text.trim()) || draft.correctOptionIds.length === 0))} onClick={() => void save(index)}>Save reviewed question</Button></div>
        </div>)}
      </CardContent>
    </Card>
  );
}
