"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flame, Play, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/challenges/code-editor";
import { runChallengeCode, type ChallengeLanguage, type ChallengeTest } from "@/lib/challenge-runner";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PublicTrack } from "@/types/api";

type ChallengeData = {
  track: { id: string; slug: string; title: string };
  challenge: null | { id: string; title: string; difficulty: "easy" | "medium" | "hard"; statement: string; starterCode: string; tests: ChallengeTest[]; publishDate: string };
  submission: null | { language: ChallengeLanguage; code: string; passed: boolean; passedTests: number; totalTests: number; attempts: number; solvedAt: string | null };
  streak: number;
};
type SubmitResult = { passed: boolean; passedTests: number; totalTests: number; visibleTests: number; hiddenTests: number; firstSolve: boolean };

export function DailyChallenge({ tracks }: { tracks: PublicTrack[] }) {
  const queryClient = useQueryClient();
  const [trackSlug, setTrackSlug] = useState(tracks[0]?.slug ?? "");
  const key = ["daily-challenge", trackSlug] as const;
  const challenge = useQuery({ queryKey: key, queryFn: () => api<ChallengeData>(`/student/challenges/${trackSlug}`), enabled: Boolean(trackSlug) });
  const [language, setLanguage] = useState<ChallengeLanguage>("javascript");
  const [code, setCode] = useState("");
  const [runResult, setRunResult] = useState<{ passed: number; total: number; results: boolean[]; outputs: string[] } | null>(null);
  const [runError, setRunError] = useState("");
  const active = challenge.data?.challenge;
  const visibleTests = useMemo(() => active?.tests ?? [], [active?.tests]);
  const resultsCacheKey = `challenge-code:${active?.id ?? "none"}:${language}`;
  useEffect(() => {
    if (!active) return;
    const saved = sessionStorage.getItem(resultsCacheKey);
    const savedSubmission = challenge.data?.submission?.language === language ? challenge.data.submission.code : undefined;
    setCode(saved ?? savedSubmission ?? (active.starterCode || (language === "javascript" ? "function solution(value) {\n  // Write your solution here\n  return value;\n}" : "def solution(value):\n    # Write your solution here\n    return value\n")));
  }, [active, challenge.data?.submission?.code, language, resultsCacheKey]);
  const submission = useMutation({
    mutationFn: (source: string) => api<SubmitResult>(`/student/challenges/${active?.id}/submissions`, { method: "POST", body: { code: source, language } }),
    onSuccess: (result) => {
      toast.success(result.passed ? (result.firstSolve ? "Challenge solved! Points awarded." : "All tests pass.") : `Server check: ${result.passedTests}/${result.totalTests} tests passed.`);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: toastError,
  });

  const run = async () => {
    if (!active) return;
    setRunError("");
    setRunResult(null);
    try {
      const result = await runChallengeCode(language, code, visibleTests, { timeoutMs: 5000, loadDataPackages: language === "python" && trackSlug === "ai-ml-data-science" });
      setRunResult(result);
    } catch (error) { setRunError(error instanceof Error ? error.message : "Could not run code."); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-heading text-2xl font-bold">Daily coding challenge</h1><p className="text-muted-foreground mt-1 text-sm">Solve one challenge each day and build a track streak.</p></div>
      <div className="min-w-52 space-y-1"><label className="text-xs font-medium" htmlFor="challenge-track">Track</label><Select value={trackSlug} onValueChange={(slug) => { setTrackSlug(slug); setCode(""); setRunResult(null); }}><SelectTrigger id="challenge-track" className="w-full"><SelectValue placeholder="Choose a track" /></SelectTrigger><SelectContent>{tracks.map((track) => <SelectItem key={track.id} value={track.slug}>{track.title}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {challenge.isLoading && <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading today’s challenge…</CardContent></Card>}
    {challenge.isError && <Card><CardContent className="p-8 text-sm text-destructive">{challenge.error instanceof Error ? challenge.error.message : "Could not load challenge."}</CardContent></Card>}
    {challenge.data && !active && <Card><CardContent className="p-8 text-center"><Sparkles className="mx-auto size-8 text-primary" /><h2 className="mt-3 font-semibold">No challenge published today</h2><p className="text-muted-foreground mt-1 text-sm">Check back soon for {challenge.data.track.title}.</p></CardContent></Card>}
    {active && <>
      <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{active.title}</CardTitle><CardDescription className="mt-2">{challenge.data?.track.title} · {new Date(active.publishDate).toLocaleDateString()}</CardDescription></div><div className="flex gap-2"><Badge variant="secondary" className="capitalize">{active.difficulty}</Badge><Badge variant="outline" className="gap-1"><Flame className="size-3.5" />{challenge.data?.streak} day streak</Badge></div></div></CardHeader><CardContent className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">{active.statement}</CardContent></Card>
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Your solution</CardTitle><CardDescription>Run visible tests locally, then submit for server-side hidden tests.</CardDescription></div><Select value={language} onValueChange={(value) => { const next = value as ChallengeLanguage; setLanguage(next); setRunResult(null); setCode(""); }}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="javascript">JavaScript</SelectItem><SelectItem value="python">Python</SelectItem></SelectContent></Select></div></CardHeader><CardContent className="space-y-4">
        <CodeEditor value={code} onChange={(value) => { setCode(value); sessionStorage.setItem(resultsCacheKey, value); }} language={language} />
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run()} disabled={!visibleTests.length || !code.trim()}><Play className="mr-2 size-4" />Run visible tests</Button><Button onClick={() => submission.mutate(code)} disabled={submission.isPending || !code.trim()}><Send className="mr-2 size-4" />{submission.isPending ? "Checking…" : "Submit solution"}</Button></div>
        {runError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{runError}</p>}
        {runResult && <div className="rounded-lg border p-4" aria-live="polite"><div className="mb-2 flex items-center gap-2 text-sm font-medium">{runResult.passed === runResult.total ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-2 rounded-full bg-warning" />}{runResult.passed}/{runResult.total} visible tests passed</div><ul className="space-y-1 text-xs">{runResult.results.map((passed, index) => <li key={index} className={passed ? "text-success" : "text-destructive"}>Test {index + 1}: {passed ? "Passed" : `Failed · ${runResult.outputs[index]}`}</li>)}</ul></div>}
        {challenge.data?.submission && <p className="text-muted-foreground text-sm">Latest server result: {challenge.data.submission.passedTests}/{challenge.data.submission.totalTests} tests passed · {challenge.data.submission.attempts} attempt(s){challenge.data.submission.solvedAt && <span className="ml-1 inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" />Solved</span>}</p>}
      </CardContent></Card>
    </>}
  </div>;
}
