"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, Megaphone, Pin, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthorLine } from "@/components/community/bits";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CommunityFeed, CommunityMe, PostCard, PublicTrack } from "@/types/api";

const tc = t.community;
const SORTS = ["newest", "top", "unanswered"] as const;
type Sort = (typeof SORTS)[number];
const ALL = "all";

export default function CommunityPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <Feed />
    </Suspense>
  );
}

function Feed() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const sort = (SORTS as readonly string[]).includes(params.get("sort") ?? "")
    ? (params.get("sort") as Sort)
    : "newest";
  const track = params.get("track") ?? "";
  const tag = params.get("tag") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(params.get("search") ?? "");

  const setParams = (next: Record<string, string | number | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === ALL) p.delete(k);
      else p.set(k, String(v));
    }
    if (!("page" in next)) p.delete("page");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  // Debounced search into the URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get("search") ?? "")) setParams({ search: search.trim() });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const me = useQuery({
    queryKey: ["community", "me"],
    queryFn: () => api<CommunityMe>("/community/me"),
  });
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  const tags = useQuery({
    queryKey: ["community", "tags"],
    queryFn: () => api<{ tag: string; count: number }[]>("/community/tags"),
  });
  const feed = useQuery({
    queryKey: ["community", "feed", { sort, track, tag, page, search: params.get("search") ?? "" }],
    queryFn: () =>
      api<CommunityFeed>("/community/posts", {
        query: { sort, track, tag, page, search: params.get("search") ?? "" },
      }),
  });
  const ack = useMutation({
    mutationFn: () => api("/community/me/warnings/acknowledge", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["community", "me"] }),
  });

  const pages = feed.data ? Math.max(1, Math.ceil(feed.data.total / feed.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title={tc.title}
        description={tc.subtitle}
        actions={
          me.data?.canParticipate && (
            <>
              {me.data.isStaff && (
                <Button variant="outline" asChild>
                  <Link href="/community/new?kind=announcement">
                    <Megaphone /> {tc.announce}
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link href="/community/new">
                  <Plus /> {tc.ask}
                </Link>
              </Button>
            </>
          )
        }
      />

      {me.data && me.data.warnings.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{tc.warningTitle}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {me.data.warnings.map((w) => (
                <li key={w.id}>{w.reason}</li>
              ))}
            </ul>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => ack.mutate()}>
              {tc.warningAck}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {me.data && !me.data.canParticipate && (
        <Alert className="mb-6">
          <AlertTitle>{tc.noAccessTitle}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {tc.noAccessBody}
            <Button size="sm" asChild>
              <Link href="/student/billing">{tc.seePlans}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tc.search}
            aria-label={tc.search}
            className="pl-8"
          />
        </div>
        <Select value={track || ALL} onValueChange={(v) => setParams({ track: v })}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{tc.allTracks}</SelectItem>
            {(tracks.data ?? []).map((tr) => (
              <SelectItem key={tr.id} value={tr.slug}>
                {tr.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={sort} onValueChange={(v) => setParams({ sort: v === "newest" ? null : v })}>
          <TabsList>
            {SORTS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {tc.sort[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {tag && (
          <Button size="sm" variant="ghost" onClick={() => setParams({ tag: null })}>
            #{tag} ✕
          </Button>
        )}
      </div>

      {tags.data && tags.data.length > 0 && !tag && (
        <div className="mb-6 flex flex-wrap gap-1.5" aria-label={tc.tags}>
          {tags.data.slice(0, 15).map((x) => (
            <button
              key={x.tag}
              type="button"
              onClick={() => setParams({ tag: x.tag })}
              className="hover:bg-muted rounded-full border px-2.5 py-0.5 text-xs"
            >
              #{x.tag} <span className="text-muted-foreground">{x.count}</span>
            </button>
          ))}
        </div>
      )}

      {feed.isError && <ErrorState error={feed.error} onRetry={() => feed.refetch()} />}
      {feed.isLoading && <LoadingRows rows={6} />}
      {feed.data && (
        <>
          {feed.data.pinned.length > 0 && (
            <ul className="mb-6 space-y-3">
              {feed.data.pinned.map((p) => (
                <PostRow key={p.id} post={p} pinned />
              ))}
            </ul>
          )}
          {feed.data.items.length === 0 ? (
            <EmptyState icon={MessageSquare} title={tc.empty} />
          ) : (
            <ul className="divide-y rounded-xl border">
              {feed.data.items.map((p) => (
                <PostRow key={p.id} post={p} onTag={(x) => setParams({ tag: x })} />
              ))}
            </ul>
          )}
          {pages > 1 && (
            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setParams({ page: page - 1 })}
              >
                {tc.pagination.previous}
              </Button>
              <span className="text-muted-foreground self-center text-sm">
                {t.common.pagination.pageOf(page, pages)}
              </span>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => setParams({ page: page + 1 })}
              >
                {tc.pagination.next}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PostRow({
  post: p,
  pinned = false,
  onTag,
}: {
  post: PostCard;
  pinned?: boolean;
  onTag?: (tag: string) => void;
}) {
  return (
    <li
      className={cn("flex gap-4 p-4", pinned && "border-primary/30 bg-primary/5 rounded-xl border")}
    >
      {!pinned && (
        <div className="hidden w-16 shrink-0 flex-col items-end gap-1 text-xs sm:flex">
          <span className="text-muted-foreground">{tc.votes(p.score)}</span>
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5",
              p.accepted
                ? "bg-success/10 text-success font-medium"
                : p.answerCount > 0
                  ? "border"
                  : "text-muted-foreground",
            )}
          >
            {tc.answers(p.answerCount)}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {pinned && (
            <StatusBadge tone="primary">
              {p.kind === "announcement" ? (
                <Megaphone className="size-3" />
              ) : (
                <Pin className="size-3" />
              )}
              {p.kind === "announcement" ? tc.announcement : tc.pinned}
            </StatusBadge>
          )}
          {p.accepted && (
            <StatusBadge tone="success">
              <CheckCircle2 className="size-3" /> {tc.solved}
            </StatusBadge>
          )}
        </div>
        <Link
          href={`/community/posts/${p.id}`}
          className="hover:text-primary mt-1 block font-medium break-words"
        >
          {p.title}
        </Link>
        {p.excerpt && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{p.excerpt}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.track && <Badge variant="secondary">{p.track.title}</Badge>}
          {p.tags.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => onTag?.(x)}
              className="text-primary bg-primary/10 rounded px-1.5 py-0.5 text-xs"
            >
              #{x}
            </button>
          ))}
          <span className="ml-auto">
            <AuthorLine author={p.author} at={p.createdAt} />
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs sm:hidden">
          {tc.votes(p.score)} · {tc.answers(p.answerCount)}
        </p>
      </div>
    </li>
  );
}
