"use client";

import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runJavaScriptSnippet } from "@/lib/js-runner";
import { runNotebookCode } from "@/lib/notebook-runner";

const RUNNERS: Record<string, "python" | "javascript"> = {
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  node: "javascript",
};

/** A lesson code example; Python and JavaScript ones can be edited and run in the browser. */
export function TryItBlock({ node }: NodeViewProps) {
  const original = node.textContent;
  const language = String(node.attrs.language ?? "").toLowerCase();
  const runner = RUNNERS[language];
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(original);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<{ text: string; error: boolean } | null>(null);

  async function run() {
    setRunning(true);
    try {
      if (runner === "python") {
        const out = await runNotebookCode(code);
        setOutput({
          text: out.stdout || (out.result != null ? JSON.stringify(out.result) : "(no output)"),
          error: false,
        });
      } else {
        const out = await runJavaScriptSnippet(code);
        setOutput({
          text: [out.stdout, out.error].filter(Boolean).join("\n") || "(no output)",
          error: !!out.error,
        });
      }
    } catch (err) {
      setOutput({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setRunning(false);
    }
  }

  return (
    <NodeViewWrapper
      className="not-prose my-4 overflow-hidden rounded-[6px] border"
      contentEditable={false}
    >
      <div className="bg-muted/60 flex items-center justify-between border-b px-3 py-1.5 text-xs font-semibold">
        <span>Example{language ? ` · ${language}` : ""}</span>
      </div>
      {!open ? (
        <pre className="bg-background border-primary overflow-x-auto border-l-4 px-4 py-3 font-mono text-sm leading-6">
          <code>{original}</code>
        </pre>
      ) : (
        <textarea
          aria-label="Edit the example code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          rows={Math.min(20, Math.max(4, code.split("\n").length + 1))}
          className="bg-background border-primary block w-full resize-y border-l-4 px-4 py-3 font-mono text-sm leading-6 outline-none"
        />
      )}
      {runner && (
        <div className="bg-muted/30 flex flex-wrap items-center gap-2 border-t px-3 py-2">
          {!open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Try it yourself »
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={() => void run()} disabled={running}>
                {running ? <Loader2 className="animate-spin" /> : <Play />} Run
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCode(original);
                  setOutput(null);
                }}
              >
                <RotateCcw /> Reset
              </Button>
              {runner === "python" && !output && (
                <span className="text-muted-foreground text-xs">
                  The first Python run takes a few seconds to load.
                </span>
              )}
            </>
          )}
        </div>
      )}
      {output && (
        <pre
          aria-live="polite"
          className={`overflow-x-auto border-t bg-[#0B1220] px-4 py-3 font-mono text-sm leading-6 whitespace-pre-wrap ${output.error ? "text-[#FCA5A5]" : "text-[#A7F3D0]"}`}
        >
          {output.text}
        </pre>
      )}
    </NodeViewWrapper>
  );
}
