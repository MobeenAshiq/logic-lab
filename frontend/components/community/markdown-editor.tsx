"use client";

import { Bold, Code, Code2, ImagePlus, Italic, Link2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";
import { Markdown } from "./markdown";

const te = t.community.editor;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Markdown textarea with a small toolbar, live preview and image upload.
 * Uploaded images are inserted as ![name](r2:<key>).
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 10,
  id,
  assetUrls = {},
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  /** Signed URLs for images already in the text (when editing). */
  assetUrls?: Record<string, string>;
  invalid?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});

  /** Wraps the selection (or inserts at the cursor). */
  const wrap = (before: string, after = before, fallback = "") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || fallback;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const insert = (text: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? value.length;
    onChange(value.slice(0, at) + text + value.slice(at));
  };

  const onImage = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error(te.imageType);
      return;
    }
    setUploading(true);
    try {
      const key = await uploadFile("/community/uploads", file);
      setLocalUrls((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
      insert(`\n![${alt}](r2:${key})\n`);
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  };

  const tools = [
    { icon: Bold, label: te.bold, run: () => wrap("**") },
    { icon: Italic, label: te.italic, run: () => wrap("_") },
    { icon: Code, label: te.code, run: () => wrap("`") },
    { icon: Code2, label: te.codeBlock, run: () => wrap("\n```\n", "\n```\n", "code") },
    { icon: Link2, label: te.link, run: () => wrap("[", "](https://)", "text") },
  ];

  return (
    <Tabs defaultValue="write">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="write">{te.write}</TabsTrigger>
          <TabsTrigger value="preview">{te.preview}</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <Button
              key={tool.label}
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={tool.label}
              title={tool.label}
              onClick={tool.run}
            >
              <tool.icon />
            </Button>
          ))}
          <input
            ref={fileInput}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => void onImage(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={te.image}
            title={te.image}
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Spinner /> : <ImagePlus />}
          </Button>
        </div>
      </div>
      <TabsContent value="write" className="mt-2">
        <Textarea
          ref={area}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={invalid}
          className="font-mono text-[13px] leading-6"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          {uploading ? te.uploading : te.markdownHint}
        </p>
      </TabsContent>
      <TabsContent value="preview" className="mt-2 min-h-40 rounded-lg border p-4">
        {value.trim() ? (
          <Markdown assetUrls={{ ...assetUrls, ...localUrls }}>{value}</Markdown>
        ) : (
          <p className="text-muted-foreground text-sm">{te.nothingToPreview}</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
