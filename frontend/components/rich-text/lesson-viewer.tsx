"use client";

import { EditorContent, Node, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TryItBlock } from "@/components/rich-text/try-it-block";
import { KeyedImage, toDisplayDoc } from "@/lib/tiptap";
import type { TiptapNode } from "@/types/api";

/** Same "codeBlock" node the editor saves, shown as a runnable "Try it yourself" example. */
const RunnableCodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,
  addAttributes() {
    return { language: { default: null } };
  },
  parseHTML() {
    return [{ tag: "pre", preserveWhitespace: "full" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["pre", ["code", HTMLAttributes, 0]];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TryItBlock);
  },
});

const viewerExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: true, autolink: true, protocols: ["https", "mailto"] },
    codeBlock: false,
  }),
  RunnableCodeBlock,
  KeyedImage,
];

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
      extensions: viewerExtensions,
      content: toDisplayDoc(content, assetUrls),
      editable: false,
      immediatelyRender: false,
      editorProps: { attributes: { class: "prose-lesson" } },
    },
    [content, assetUrls],
  );
  return <EditorContent editor={editor} />;
}
