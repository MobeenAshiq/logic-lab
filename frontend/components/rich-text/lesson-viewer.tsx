"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { lessonExtensions, toDisplayDoc } from "@/lib/tiptap";
import type { TiptapNode } from "@/types/api";

/** Read-only article renderer (same schema as the admin editor). */
export function LessonViewer({
  content,
  assetUrls,
}: {
  content: TiptapNode | null;
  assetUrls: Record<string, string>;
}) {
  const editor = useEditor(
    {
      extensions: lessonExtensions,
      content: toDisplayDoc(content, assetUrls),
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "prose-lesson" } },
    },
    [content, assetUrls],
  );
  return <EditorContent editor={editor} />;
}
