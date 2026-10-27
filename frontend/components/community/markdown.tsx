"use client";

import "highlight.js/styles/github-dark.css";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Keeps our r2:<key> image references; everything else goes through the safe default. */
function urlTransform(url: string) {
  return url.startsWith("r2:") ? url : defaultUrlTransform(url);
}

/**
 * Renders community Markdown safely (no raw HTML). Images only render when
 * they are our own uploads (r2:<key>, signed by the API); other images show
 * as links so posts cannot load third-party trackers.
 */
export function Markdown({
  children,
  assetUrls = {},
  className,
}: {
  children: string;
  assetUrls?: Record<string, string>;
  className?: string;
}) {
  return (
    <div className={cn("prose-lesson break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={urlTransform}
        components={{
          img: ({ src, alt }) => {
            const ref = typeof src === "string" && src.startsWith("r2:") ? src.slice(3) : null;
            const signed = ref ? assetUrls[ref] : null;
            if (signed) {
              // eslint-disable-next-line @next/next/no-img-element
              return <img src={signed} alt={alt ?? ""} loading="lazy" />;
            }
            return typeof src === "string" && src && !ref ? (
              <a href={src} target="_blank" rel="noopener noreferrer nofollow">
                {alt || src}
              </a>
            ) : null;
          },
          a: ({ href, children: text }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {text}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** A code snippet field rendered as a highlighted fenced block. */
export function CodeSnippet({ code, language }: { code: string; language: string | null }) {
  const fence = code.includes("```") ? "~~~~" : "```";
  return <Markdown>{`${fence}${language ?? ""}\n${code}\n${fence}`}</Markdown>;
}
