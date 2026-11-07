"use client";

import { Check, Code2, Copy, Pencil, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/challenges/code-editor";
import { Markdown } from "@/components/community/markdown";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CodeBlock } from "@/lib/ai-mentor";
import { runJavaScript } from "@/lib/js-sandbox";
import { runNotebookCode } from "@/lib/notebook-runner";
import { cn } from "@/lib/utils";

const RUNNABLE: Record<string, "javascript" | "python"> = {
  js: "javascript",
  javascript: "javascript",
  node: "javascript",
  nodejs: "javascript",
  py: "python",
  python: "python",
};

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard.");
  } catch {
    toast.error("Could not copy. Select the code and copy it manually.");
  }
}

/** Right panel: every code block from the chat, with copy, edit and (JS/Python) run. */
export function CodePanel({ blocks, selectedId, onSelect }: { blocks: CodeBlock[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const block = blocks.find((b) => b.id === selectedId) ?? blocks[blocks.length - 1] ?? null;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [output, setOutput] = useState<{ ok: boolean; text: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(block?.code ?? "");
    setEditing(false);
    setOutput(null);
  }, [block?.id, block?.code]);

  const runtime = block ? RUNNABLE[block.language.toLowerCase()] : undefined;

  const run = async () => {
    if (!runtime) return;
    setRunning(true);
    setOutput(null);
    try {
      if (runtime === "javascript") {
        const result = await runJavaScript(draft);
        setOutput({ ok: result.ok, text: result.output || "(no output)" });
      } else {
        const result = await runNotebookCode(draft);
        const text = [result.stdout, result.result === undefined || result.result === null ? "" : String(result.result)].filter(Boolean).join("\n");
        setOutput({ ok: true, text: text || "(no output)" });
      }
    } catch (error) {
      setOutput({ ok: false, text: error instanceof Error ? error.message : String(error) });
    } finally {
      setRunning(false);
    }
  };

  const copy = async () => {
    await copyText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4" aria-label="Code sandbox">
      <div className="flex items-center gap-2 text-sm font-semibold"><Code2 className="size-4 text-primary" /> Code sandbox</div>
      {!block ? (
        <p className="text-sm text-muted-foreground">Code from the mentor&apos;s answers appears here, ready to copy, tweak, and run (JavaScript and Python run right in your browser).</p>
      ) : (
        <>
          {blocks.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Code snippets">
              {blocks.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={b.id === block.id}
                  onClick={() => onSelect(b.id)}
                  className={cn("rounded-md border px-2 py-0.5 font-mono text-xs", b.id === block.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
                >
                  #{i + 1} {b.language}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => void copy()}>{copied ? <Check /> : <Copy />} Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}><Pencil /> {editing ? "View" : "Edit"}</Button>
            {draft !== block.code && <Button size="sm" variant="ghost" onClick={() => setDraft(block.code)}><RotateCcw /> Reset</Button>}
            {runtime && <Button size="sm" onClick={() => void run()} disabled={running} className="ml-auto">{running ? <Spinner /> : <Play />} Run</Button>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {editing ? (
              runtime ? (
                <CodeEditor value={draft} onChange={setDraft} language={runtime} height={320} />
              ) : (
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="font-mono text-xs" spellCheck={false} aria-label="Edit code" />
              )
            ) : (
              <Markdown className="text-xs [&_pre]:m-0">{`\`\`\`\`${block.language}\n${draft}\n\`\`\`\``}</Markdown>
            )}
          </div>
          {output && (
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Output</p>
              <pre className={cn("max-h-40 overflow-auto rounded-lg bg-muted p-2 font-mono text-xs whitespace-pre-wrap", !output.ok && "text-danger")}>{output.text}</pre>
            </div>
          )}
          {runtime === "javascript" && <p className="text-[11px] text-muted-foreground">Runs in an isolated browser worker: no DOM, network, or Node.js modules.</p>}
        </>
      )}
    </aside>
  );
}
