"use client";

import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { diffEdit } from "@/lib/integrity";
import { cn } from "@/lib/utils";
import type { TypingEvent } from "@/types/api";

const FLUSH_EVERY_MS = 10_000;
const BLOCKED_INPUT = new Set([
  "insertFromPaste",
  "insertFromDrop",
  "insertFromYank",
  "insertFromPasteAsQuotation",
]);

export interface WriteOnlyEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Receives recorded typing events in batches (every 10 s, on blur and on unmount). */
  onEvents: (events: TypingEvent[]) => void | Promise<unknown>;
  code?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
  "aria-label"?: string;
}

/**
 * A textarea you can only type into: paste, drop and the context menu are
 * blocked, and every change is recorded as a small edit so a mentor can
 * replay how the answer was written. The server checks the recording again.
 */
export function WriteOnlyEditor({
  value,
  onChange,
  onEvents,
  code = false,
  disabled = false,
  placeholder,
  rows = 10,
  maxLength = 20_000,
  id,
  ...aria
}: WriteOnlyEditorProps) {
  const buffer = useRef<TypingEvent[]>([]);
  const last = useRef(value);
  const onEventsRef = useRef(onEvents);
  onEventsRef.current = onEvents;
  const [notice, setNotice] = useState(false);

  // Value changed from outside (e.g. draft loaded): don't record that as typing.
  useEffect(() => {
    last.current = value;
  }, [value]);

  const flush = useCallback(() => {
    if (buffer.current.length === 0) return;
    const batch = buffer.current;
    buffer.current = [];
    void onEventsRef.current(batch);
  }, []);

  useEffect(() => {
    const timer = setInterval(flush, FLUSH_EVERY_MS);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const blocked = () => {
    buffer.current.push({ at: Date.now(), kind: "paste_blocked" });
    setNotice(true);
    window.setTimeout(() => setNotice(false), 4000);
  };

  return (
    <div className="space-y-1.5">
      <textarea
        id={id}
        {...aria}
        value={value}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={!code}
        autoCorrect={code ? "off" : undefined}
        autoCapitalize={code ? "off" : undefined}
        className={cn(
          "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 disabled:opacity-60",
          code && "font-mono text-[13px] leading-6",
        )}
        onPaste={(e) => {
          e.preventDefault();
          blocked();
        }}
        onDrop={(e) => {
          e.preventDefault();
          blocked();
        }}
        onContextMenu={(e) => e.preventDefault()}
        onBeforeInput={(e) => {
          const type = (e.nativeEvent as InputEvent).inputType;
          if (BLOCKED_INPUT.has(type)) {
            e.preventDefault();
            blocked();
          }
        }}
        onKeyDown={(e) => {
          // Code answers: Tab inserts two spaces instead of leaving the field.
          if (code && e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart: s, selectionEnd: end } = el;
            const next = value.slice(0, s) + "  " + value.slice(end);
            const edit = diffEdit(last.current, next);
            if (edit) buffer.current.push(edit);
            last.current = next;
            onChange(next);
            requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          const edit = diffEdit(last.current, next);
          if (edit) buffer.current.push(edit);
          last.current = next;
          onChange(next);
        }}
        onBlur={flush}
      />
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={cn("flex items-center gap-1", notice && "text-warning font-medium")}>
          <ShieldAlert className="size-3.5" />
          {notice ? t.assessments.editor.pasteBlocked : t.assessments.editor.recording}
        </span>
        <span>{t.assessments.editor.chars(value.length)}</span>
      </div>
    </div>
  );
}
