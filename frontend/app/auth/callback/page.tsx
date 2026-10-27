"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/shared";
import { api } from "@/lib/api/client";
import { afterLoginPath, ME_KEY } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { SessionResponse } from "@/types/api";

/** The API redirects here after Google login, with the session cookies already set. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    api<SessionResponse>("/me", { requireAuth: false })
      .then((session) => {
        queryClient.setQueryData(ME_KEY, session);
        router.replace(afterLoginPath(session.user.role, session.mfa));
      })
      .catch(() => router.replace("/login?reason=GOOGLE_LOGIN_FAILED"));
  }, [queryClient, router]);

  return (
    <div className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2 text-sm">
      <Spinner /> {t.auth.callback.working}
    </div>
  );
}
