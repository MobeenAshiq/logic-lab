"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="bg-muted h-[360px] animate-pulse rounded-lg" />,
});

export function CodeEditor({
  value,
  onChange,
  language,
  pasteBlocked = false,
  height = 360,
}: {
  value: string;
  onChange: (value: string) => void;
  language: "javascript" | "python";
  pasteBlocked?: boolean;
  height?: number;
}) {
  const [pasteNotice, setPasteNotice] = useState(false);
  const options = useMemo(() => ({
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 4,
    insertSpaces: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    wordWrap: "on" as const,
    readOnly: false,
  }), []);

  useEffect(() => {
    if (!pasteBlocked) return;
    const block = (event: ClipboardEvent) => {
      event.preventDefault();
      setPasteNotice(true);
      window.setTimeout(() => setPasteNotice(false), 3500);
    };
    document.addEventListener("paste", block, true);
    return () => document.removeEventListener("paste", block, true);
  }, [pasteBlocked]);

  return <div className="overflow-hidden rounded-lg border">
    {pasteNotice && <p className="bg-warning/10 text-warning px-3 py-2 text-xs font-medium">Pasting is disabled for this graded challenge.</p>}
    <Monaco height={height} language={language === "javascript" ? "javascript" : "python"} theme="vs-dark" value={value} onChange={(next) => onChange(next ?? "")} options={options} />
  </div>;
}
