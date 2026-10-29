"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, Field, LoadingRows, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import type { PublicTrack } from "@/types/api";

const sampleTests = JSON.stringify([{ input: ["level"], expected: true }, { input: ["Logic"], expected: false }], null, 2);

export default function AdminChallengesPage() {
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  const [trackId, setTrackId] = useState("");
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [statement, setStatement] = useState("");
  const [starterCode, setStarterCode] = useState("function solution(value) {\n  return value;\n}");
  const [publishDate, setPublishDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tests, setTests] = useState(sampleTests);
  const [hiddenTests, setHiddenTests] = useState("[{\"input\":[\"racecar\"],\"expected\":true}]");
  const [graded, setGraded] = useState(false);
  const create = useMutation({
    mutationFn: async () => {
      let visible: unknown;
      let hidden: unknown;
      try { visible = JSON.parse(tests); hidden = JSON.parse(hiddenTests); }
      catch { throw new Error("Both test fields must contain valid JSON arrays."); }
      return api("/admin/challenges", { method: "POST", body: { trackId, title, difficulty, statement, starterCode, publishDate, tests: visible, hiddenTests: hidden, graded } });
    },
    onSuccess: () => { toast.success("Daily challenge published."); setTitle(""); setStatement(""); },
    onError: toastError,
  });
  if (tracks.isError) return <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />;
  if (!tracks.data) return <LoadingRows rows={4} />;
  const availableTracks = tracks.data;
  return <div className="space-y-6">
    <PageHeader title="Daily coding challenges" description="Publish one challenge per track and Pakistan-local date. Hidden tests are server-side only." />
    <Card><CardHeader><CardTitle>Create a challenge</CardTitle><CardDescription>Student-visible cases run in a Web Worker; all visible and hidden cases are rechecked on the server before a solve is recorded.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <Field label="Track" htmlFor="challenge-track"><Select value={trackId} onValueChange={setTrackId}><SelectTrigger id="challenge-track" className="w-full"><SelectValue placeholder="Choose a track" /></SelectTrigger><SelectContent>{availableTracks.map((track) => <SelectItem key={track.id} value={track.id}>{track.title}</SelectItem>)}</SelectContent></Select></Field>
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Title" htmlFor="challenge-title"><Input id="challenge-title" required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></Field><Field label="Difficulty" htmlFor="challenge-difficulty"><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger id="challenge-difficulty"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></Field><Field label="Publish date" htmlFor="challenge-date"><Input id="challenge-date" type="date" required value={publishDate} onChange={(event) => setPublishDate(event.target.value)} /></Field></div>
      <Field label="Problem statement" htmlFor="challenge-statement"><Textarea id="challenge-statement" rows={5} value={statement} onChange={(event) => setStatement(event.target.value)} maxLength={12_000} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={graded} onChange={(event) => setGraded(event.target.checked)} />Graded challenge (disable clipboard paste in the student editor)</label>
      <Field label="Starter code (function expression / solution function)" htmlFor="challenge-starter"><Textarea id="challenge-starter" rows={6} value={starterCode} onChange={(event) => setStarterCode(event.target.value)} className="font-mono text-xs" /></Field>
      <div className="grid gap-4 lg:grid-cols-2"><Field label="Visible tests JSON" htmlFor="challenge-tests" hint={'Array of {"input":[...],"expected":...} objects.'}><Textarea id="challenge-tests" rows={8} value={tests} onChange={(event) => setTests(event.target.value)} className="font-mono text-xs" /></Field><Field label="Hidden tests JSON" htmlFor="challenge-hidden" hint="Never returned to the browser. At least one required."><Textarea id="challenge-hidden" rows={8} value={hiddenTests} onChange={(event) => setHiddenTests(event.target.value)} className="font-mono text-xs" /></Field></div>
      <div className="flex justify-end"><Button type="submit" disabled={create.isPending || !trackId || title.trim().length < 3 || statement.trim().length < 10}>{create.isPending ? "Publishing…" : "Publish challenge"}</Button></div>
    </form></CardContent></Card>
  </div>;
}
