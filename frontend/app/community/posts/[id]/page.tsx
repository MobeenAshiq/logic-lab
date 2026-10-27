"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, EyeOff, Megaphone, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AuthorLine, ReportButton, VoteControl } from "@/components/community/bits";
import { CodeSnippet, Markdown } from "@/components/community/markdown";
import { MarkdownEditor } from "@/components/community/markdown-editor";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CommunityAnswer, CommunityPost } from "@/types/api";

const tc = t.community;
const postKey = (id: string) => ["community", "post", id] as const;

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const post = useQuery({
    queryKey: postKey(id),
    queryFn: () => api<CommunityPost>(`/community/posts/${id}`),
  });
  if (post.isError) return <ErrorState error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data) return <LoadingRows rows={6} />;
  return <PostView post={post.data} />;
}

function PostView({ post: p }: { post: CommunityPost }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = (data: CommunityPost) => {
    queryClient.setQueryData(postKey(p.id), data);
    void queryClient.invalidateQueries({ queryKey: ["community", "feed"] });
  };

  const accept = useMutation({
    mutationFn: (answerId: string | null) =>
      api<CommunityPost>(`/community/posts/${p.id}/accept`, { method: "POST", body: { answerId } }),
    onSuccess: refresh,
    onError: toastError,
  });
  const removePost = useMutation({
    mutationFn: () => api(`/community/posts/${p.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(tc.deleted);
      void queryClient.invalidateQueries({ queryKey: ["community"] });
      router.replace("/community");
    },
    onError: toastError,
  });

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        href="/community"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {tc.back}
      </Link>

      {p.hidden && (
        <Alert className="mb-4">
          <EyeOff />
          <AlertDescription>{tc.hiddenNotice}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        <VoteControl
          targetType="post"
          targetId={p.id}
          score={p.score}
          myVote={p.myVote}
          disabled={p.isMine || !p.canParticipate}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {p.kind === "announcement" && (
              <StatusBadge tone="primary">
                <Megaphone className="size-3" /> {tc.announcement}
              </StatusBadge>
            )}
            {p.acceptedAnswerId && (
              <StatusBadge tone="success">
                <CheckCircle2 className="size-3" /> {tc.solved}
              </StatusBadge>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AuthorLine author={p.author} at={p.createdAt} />
            {p.track && <Badge variant="secondary">{p.track.title}</Badge>}
            {p.tags.map((tag) => (
              <Link
                key={tag}
                href={`/community?tag=${encodeURIComponent(tag)}`}
                className="text-primary bg-primary/10 rounded px-1.5 py-0.5 text-xs"
              >
                #{tag}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            <Markdown assetUrls={p.assetUrls}>{p.body}</Markdown>
            {p.codeSnippet && <CodeSnippet code={p.codeSnippet} language={p.codeLanguage} />}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1">
            {p.isMine ? (
              <>
                <Button size="xs" variant="ghost" asChild>
                  <Link href={`/community/posts/${p.id}/edit`}>
                    <Pencil /> {tc.edit}
                  </Link>
                </Button>
                <ConfirmDialog
                  title={tc.delete}
                  description={tc.deleteConfirm}
                  destructive
                  confirmLabel={tc.delete}
                  onConfirm={() => removePost.mutateAsync()}
                >
                  <Button size="xs" variant="ghost" className="text-destructive">
                    <Trash2 /> {tc.delete}
                  </Button>
                </ConfirmDialog>
              </>
            ) : (
              <ReportButton targetType="post" targetId={p.id} reported={p.reportedByMe} />
            )}
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">{tc.answers(p.answers.length)}</h2>
        {p.answers.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tc.noAnswers}</p>
        ) : (
          <ul className="space-y-4">
            {p.answers.map((a) => (
              <AnswerItem
                key={a.id}
                answer={a}
                post={p}
                assetUrls={p.assetUrls}
                onAccept={(answerId) => accept.mutate(answerId)}
                accepting={accept.isPending}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </section>

      {p.canParticipate && !p.hidden && <AnswerForm postId={p.id} onSaved={refresh} />}
    </article>
  );
}

function AnswerItem({
  answer: a,
  post,
  assetUrls,
  onAccept,
  accepting,
  onChanged,
}: {
  answer: CommunityAnswer;
  post: CommunityPost;
  assetUrls: Record<string, string>;
  onAccept: (answerId: string | null) => void;
  accepting: boolean;
  onChanged: (post: CommunityPost) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(a.body);
  const save = useMutation({
    mutationFn: () =>
      api<CommunityPost>(`/community/answers/${a.id}`, { method: "PATCH", body: { body } }),
    onSuccess: (data) => {
      setEditing(false);
      onChanged(data);
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: () => api(`/community/answers/${a.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(tc.deleted);
      void queryClient.invalidateQueries({ queryKey: postKey(post.id) });
    },
    onError: toastError,
  });

  return (
    <li
      className={cn(
        "flex gap-4 rounded-xl border p-4",
        a.accepted && "border-success/50 bg-success/5",
        a.isStaff && !a.accepted && "border-primary/30",
      )}
    >
      <VoteControl
        targetType="answer"
        targetId={a.id}
        score={a.score}
        myVote={a.myVote}
        disabled={a.isMine || !post.canParticipate}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <AuthorLine author={a.author} at={a.createdAt} verb="answered" />
          {a.accepted && (
            <StatusBadge tone="success">
              <CheckCircle2 className="size-3" /> {tc.accepted}
            </StatusBadge>
          )}
          {a.hidden && (
            <StatusBadge tone="warning">
              <EyeOff className="size-3" /> {tc.hiddenNotice}
            </StatusBadge>
          )}
        </div>
        {editing ? (
          <div className="mt-3 space-y-2">
            <MarkdownEditor value={body} onChange={setBody} assetUrls={assetUrls} rows={6} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t.common.actions.cancel}
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending || body.trim().length < 10}
              >
                {save.isPending && <Spinner />}
                {t.common.actions.save}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <Markdown assetUrls={assetUrls}>{a.body}</Markdown>
            {a.codeSnippet && <CodeSnippet code={a.codeSnippet} language={a.codeLanguage} />}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          {post.canAccept && (
            <Button
              size="xs"
              variant={a.accepted ? "outline" : "secondary"}
              disabled={accepting}
              onClick={() => onAccept(a.accepted ? null : a.id)}
            >
              <CheckCircle2 /> {a.accepted ? tc.unaccept : tc.accept}
            </Button>
          )}
          {a.isMine ? (
            <>
              <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil /> {tc.edit}
              </Button>
              <ConfirmDialog
                title={tc.delete}
                description={tc.deleteConfirm}
                destructive
                confirmLabel={tc.delete}
                onConfirm={() => remove.mutateAsync()}
              >
                <Button size="xs" variant="ghost" className="text-destructive">
                  <Trash2 /> {tc.delete}
                </Button>
              </ConfirmDialog>
            </>
          ) : (
            <ReportButton targetType="answer" targetId={a.id} reported={a.reportedByMe} />
          )}
        </div>
      </div>
    </li>
  );
}

function AnswerForm({
  postId,
  onSaved,
}: {
  postId: string;
  onSaved: (post: CommunityPost) => void;
}) {
  const [body, setBody] = useState("");
  const send = useMutation({
    mutationFn: () =>
      api<CommunityPost>(`/community/posts/${postId}/answers`, { method: "POST", body: { body } }),
    onSuccess: (data) => {
      setBody("");
      onSaved(data);
    },
    onError: toastError,
  });
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>{tc.yourAnswer}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MarkdownEditor
          value={body}
          onChange={setBody}
          placeholder={tc.answerPlaceholder}
          rows={8}
        />
        <div className="flex justify-end">
          <Button
            onClick={() => send.mutate()}
            disabled={send.isPending || body.trim().length < 10}
          >
            {send.isPending && <Spinner />}
            {tc.postAnswer}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
