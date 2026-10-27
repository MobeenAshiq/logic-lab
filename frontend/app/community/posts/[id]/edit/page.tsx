"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PostForm } from "@/components/community/post-form";
import { ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { CommunityPost } from "@/types/api";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const post = useQuery({
    queryKey: ["community", "post", id],
    queryFn: () => api<CommunityPost>(`/community/posts/${id}`),
  });
  if (post.isError) return <ErrorState error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data) return <LoadingRows rows={4} />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.community.editor.editTitle} />
      <PostForm kind={post.data.kind} post={post.data} />
    </div>
  );
}
