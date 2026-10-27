"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { CODE_LANGUAGES } from "@/lib/i18n/en/community";
import type { CommunityPost, PostKind, PublicTrack } from "@/types/api";
import { MarkdownEditor } from "./markdown-editor";

const te = t.community.editor;
const NO_TRACK = "none";
const TAG = /^[a-z0-9][a-z0-9+#.-]{0,29}$/;

const schema = z.object({
  title: z.string().trim().min(8).max(160),
  body: z.string().trim().min(10).max(20_000),
  codeSnippet: z.string().max(20_000),
  codeLanguage: z.enum(CODE_LANGUAGES),
  trackId: z.string(),
  tags: z
    .string()
    .transform((v) => [
      ...new Set(
        v
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string().regex(TAG, te.tagsHint)).max(5, te.tagsHint)),
});
type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

/** Create or edit a community post. */
export function PostForm({ kind, post }: { kind: PostKind; post?: CommunityPost }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tracks = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api<PublicTrack[]>("/tracks"),
  });
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: post?.title ?? "",
      body: post?.body ?? "",
      codeSnippet: post?.codeSnippet ?? "",
      codeLanguage: (post?.codeLanguage as Input["codeLanguage"]) ?? "javascript",
      trackId: post?.track?.id ?? NO_TRACK,
      tags: post?.tags.join(", ") ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (v: Output) => {
      const body = {
        title: v.title,
        body: v.body,
        codeSnippet: v.codeSnippet.trim() ? v.codeSnippet : null,
        codeLanguage: v.codeSnippet.trim() ? v.codeLanguage : null,
        tags: v.tags,
        trackId: v.trackId === NO_TRACK ? null : v.trackId,
      };
      return post
        ? api<CommunityPost>(`/community/posts/${post.id}`, { method: "PATCH", body })
        : api<CommunityPost>("/community/posts", { method: "POST", body: { ...body, kind } });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["community"] });
      router.push(`/community/posts/${saved.id}`);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const errors = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <Card>
        <CardContent className="grid gap-5">
          <Field label={te.title} htmlFor="title" hint={te.titleHint} error={errors.title?.message}>
            <Input id="title" maxLength={160} {...form.register("title")} />
          </Field>
          <Field label={te.body} error={errors.body?.message}>
            <Controller
              control={form.control}
              name="body"
              render={({ field }) => (
                <MarkdownEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={te.bodyPlaceholder}
                  assetUrls={post?.assetUrls}
                  invalid={Boolean(errors.body)}
                  rows={12}
                />
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label={te.codeSnippet} htmlFor="code" error={errors.codeSnippet?.message}>
              <Textarea
                id="code"
                rows={6}
                className="font-mono text-[13px]"
                spellCheck={false}
                {...form.register("codeSnippet")}
              />
            </Field>
            <Field label={te.codeLanguage}>
              <Controller
                control={form.control}
                name="codeLanguage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {t.community.languages[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={te.track}>
              <Controller
                control={form.control}
                name="trackId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TRACK}>{te.noTrack}</SelectItem>
                      {(tracks.data ?? []).map((tr) => (
                        <SelectItem key={tr.id} value={tr.id}>
                          {tr.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={te.tags} htmlFor="tags" hint={te.tagsHint} error={errors.tags?.message}>
              <Input id="tags" placeholder="loops, python" {...form.register("tags")} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />}
              {post ? te.save : kind === "announcement" ? te.publishAnnouncement : te.publish}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
