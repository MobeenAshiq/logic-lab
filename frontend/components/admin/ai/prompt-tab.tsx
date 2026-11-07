"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorState, Field, LoadingRows, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AiMentorConfig } from "@/lib/ai-mentor";
import { useMentorConfig } from "./providers-tab";

/** System prompt, refusal message, extra blocked phrases and the on/off switch. */
export function PromptTab() {
  const { query, save } = useMentorConfig();
  const [draft, setDraft] = useState<AiMentorConfig | null>(null);
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (query.isLoading || !draft) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(query.data);
  const addPhrase = () => {
    const p = phrase.trim();
    if (p.length < 2 || draft.blockedPhrases.some((x) => x.toLowerCase() === p.toLowerCase())) return;
    setDraft({ ...draft, blockedPhrases: [...draft.blockedPhrases, p] });
    setPhrase("");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>AI Mentor for students</CardTitle>
              <CardDescription>Switch off to pause the mentor without a redeploy. Other AI features follow the daily limit in Settings.</CardDescription>
            </div>
            <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} aria-label="AI Mentor enabled" />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System prompt</CardTitle>
          <CardDescription>
            Sent with every mentor message, followed by the student&apos;s stack, the matching lesson content from their module, and a fixed refusal protocol (always added by the server, so editing this can&apos;t switch safety logging off).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Instructions" htmlFor="system-prompt" hint={`${draft.systemPrompt.length} / 8000 characters`}>
            <Textarea id="system-prompt" rows={14} value={draft.systemPrompt} onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })} maxLength={8000} className="font-mono text-xs" />
          </Field>
          <Field label="Refusal message" htmlFor="refusal" hint="Shown to the student when a question is blocked or refused.">
            <Textarea id="refusal" rows={3} value={draft.refusalMessage} onChange={(e) => setDraft({ ...draft, refusalMessage: e.target.value })} maxLength={1000} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked phrases</CardTitle>
          <CardDescription>
            Messages containing any of these (case-insensitive) are refused before reaching a provider, and logged. Prompt injections and requests for malware are already blocked built-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addPhrase(); }}>
            <Label htmlFor="phrase" className="sr-only">New blocked phrase</Label>
            <Input id="phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} maxLength={200} placeholder="e.g. exam answers" className="max-w-sm" />
            <Button type="submit" variant="secondary" disabled={phrase.trim().length < 2}><Plus /> Add</Button>
          </form>
          {draft.blockedPhrases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No extra phrases.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {draft.blockedPhrases.map((p) => (
                <li key={p} className="flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
                  {p}
                  <button type="button" aria-label={`Remove ${p}`} onClick={() => setDraft({ ...draft, blockedPhrases: draft.blockedPhrases.filter((x) => x !== p) })} className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end gap-2">
        {dirty && <Button variant="outline" onClick={() => setDraft(query.data!)}>Discard</Button>}
        <Button disabled={!dirty || save.isPending || draft.systemPrompt.trim().length < 20 || draft.refusalMessage.trim().length < 10} onClick={() => save.mutate(draft)}>
          {save.isPending && <Spinner />} Save changes
        </Button>
      </div>
    </div>
  );
}
