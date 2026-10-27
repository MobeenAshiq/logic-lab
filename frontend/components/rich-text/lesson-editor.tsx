"use client";

import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { lessonExtensions, toDisplayDoc } from "@/lib/tiptap";
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { TiptapNode } from "@/types/api";

const e = t.adminContent.editor;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(active && "bg-primary/10 text-primary hover:bg-primary/15")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      strike: ed.isActive("strike"),
      code: ed.isActive("code"),
      h1: ed.isActive("heading", { level: 1 }),
      h2: ed.isActive("heading", { level: 2 }),
      h3: ed.isActive("heading", { level: 3 }),
      bulletList: ed.isActive("bulletList"),
      orderedList: ed.isActive("orderedList"),
      blockquote: ed.isActive("blockquote"),
      codeBlock: ed.isActive("codeBlock"),
      link: ed.isActive("link"),
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
    }),
  });

  function setLink() {
    const previous = (editor.getAttributes("link").href as string | undefined) ?? "";
    const url = window.prompt(e.linkPrompt, previous);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^(https:\/\/|mailto:)/.test(trimmed)) {
      toast.error(e.linkInvalid);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error(e.imageType);
    if (file.size > MAX_UPLOAD_BYTES) return toast.error(e.imageSize);
    setUploading(true);
    try {
      const key = await uploadFile("/admin/uploads", file, { purpose: "lesson-image" });
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: { key, src: URL.createObjectURL(file), alt: file.name },
        })
        .run();
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const chain = () => editor.chain().focus();
  const sep = <Separator orientation="vertical" className="mx-1 h-5" />;

  return (
    <div className="bg-card/95 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b p-1.5 backdrop-blur">
      <ToolButton label={e.bold} active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton
        label={e.italic}
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic />
      </ToolButton>
      <ToolButton
        label={e.strike}
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolButton>
      <ToolButton label={e.code} active={state.code} onClick={() => chain().toggleCode().run()}>
        <Code />
      </ToolButton>
      <ToolButton label={e.link} active={state.link} onClick={setLink}>
        <Link2 />
      </ToolButton>
      {sep}
      <ToolButton
        label={e.h1}
        active={state.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </ToolButton>
      <ToolButton
        label={e.h2}
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolButton>
      <ToolButton
        label={e.h3}
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 />
      </ToolButton>
      {sep}
      <ToolButton
        label={e.bulletList}
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label={e.orderedList}
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolButton>
      <ToolButton
        label={e.blockquote}
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote />
      </ToolButton>
      <ToolButton
        label={e.codeBlock}
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        <SquareCode />
      </ToolButton>
      <ToolButton label={e.rule} onClick={() => chain().setHorizontalRule().run()}>
        <Minus />
      </ToolButton>
      {sep}
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(ev) => void insertImage(ev.target.files?.[0])}
      />
      <ToolButton
        label={uploading ? e.imageUploading : e.image}
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Spinner /> : <ImagePlus />}
      </ToolButton>
      <div className="ml-auto flex">
        <ToolButton label={e.undo} disabled={!state.canUndo} onClick={() => chain().undo().run()}>
          <Undo2 />
        </ToolButton>
        <ToolButton label={e.redo} disabled={!state.canRedo} onClick={() => chain().redo().run()}>
          <Redo2 />
        </ToolButton>
      </div>
    </div>
  );
}

/**
 * Article editor. `onChange` receives the editor JSON (with display `src` on
 * images); pass it through toStorageDoc() before saving.
 */
export function LessonEditor({
  content,
  assetUrls,
  onChange,
}: {
  content: TiptapNode | null;
  assetUrls: Record<string, string>;
  onChange: (doc: TiptapNode) => void;
}) {
  const editor = useEditor({
    extensions: lessonExtensions,
    content: toDisplayDoc(content, assetUrls),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-lesson px-4 py-3 sm:px-6",
        "data-placeholder": e.placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getJSON() as TiptapNode),
  });

  return (
    <div className="bg-card focus-within:border-ring rounded-xl border">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b" />}
      <EditorContent editor={editor} />
    </div>
  );
}
