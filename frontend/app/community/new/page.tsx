"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PostForm } from "@/components/community/post-form";
import { LoadingRows, PageHeader } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { CommunityMe } from "@/types/api";

function NewPost() {
  const announcement = useSearchParams().get("kind") === "announcement";
  const me = useQuery({
    queryKey: ["community", "me"],
    queryFn: () => api<CommunityMe>("/community/me"),
  });
  if (!me.data) return <LoadingRows rows={4} />;
  const kind = announcement && me.data.isStaff ? "announcement" : "question";
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/community"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t.community.back}
      </Link>
      <PageHeader
        title={
          kind === "announcement"
            ? t.community.editor.announcementTitle
            : t.community.editor.newTitle
        }
      />
      {me.data.canParticipate ? (
        <PostForm kind={kind} />
      ) : (
        <Alert>
          <AlertDescription>{t.community.noAccessBody}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={<LoadingRows rows={4} />}>
      <NewPost />
    </Suspense>
  );
}
