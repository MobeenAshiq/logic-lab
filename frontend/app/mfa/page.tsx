"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthCard, CodeInput, FormAlert } from "@/components/auth/auth-ui";
import { Logo } from "@/components/logo";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { afterLoginPath, ME_KEY, useLogout, useMe } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { MfaSetup } from "@/types/api";

function MfaFlow() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const logout = useLogout();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mode = me?.mfa;

  // Setup creates a new secret on the server, so request it only once per visit.
  const setup = useMutation({
    mutationFn: () => api<MfaSetup>("/auth/mfa/setup", { method: "POST" }),
  });
  const setupRequested = useRef(false);
  useEffect(() => {
    if (mode === "setup" && !setupRequested.current) {
      setupRequested.current = true;
      setup.mutate();
    }
  }, [mode, setup]);

  const submit = useMutation({
    mutationFn: (value: string) =>
      api(mode === "setup" ? "/auth/mfa/enable" : "/auth/mfa/verify", {
        method: "POST",
        body: { code: value },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      if (me) router.replace(afterLoginPath(me.user.role, "none", next));
    },
    onError: (err) => {
      setError(errorMessage(err));
      setCode("");
    },
  });

  const onComplete = (value: string) => {
    setError(null);
    submit.mutate(value);
  };

  if (!me) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  return (
    <AuthCard
      title={mode === "setup" ? t.auth.mfa.setupTitle : t.auth.mfa.verifyTitle}
      subtitle={mode === "setup" ? t.auth.mfa.setupSubtitle : t.auth.mfa.verifySubtitle}
      footer={
        <button type="button" className="hover:text-foreground" onClick={() => logout.mutate()}>
          {t.common.actions.logout}
        </button>
      }
    >
      <FormAlert message={error ?? (setup.error ? errorMessage(setup.error) : null)} />
      {mode === "setup" && (
        <div className="grid gap-3 text-sm">
          <p className="font-medium">{t.auth.mfa.step1}</p>
          {setup.data ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.data.qrCodeDataUrl}
                alt=""
                className="mx-auto size-44 rounded-lg border bg-white p-2"
              />
              <p className="text-muted-foreground text-xs">{t.auth.mfa.manual}</p>
              <code className="bg-muted rounded-md px-3 py-2 text-center font-mono text-xs break-all">
                {setup.data.secret}
              </code>
            </>
          ) : (
            <Skeleton className="mx-auto size-44" />
          )}
          <p className="mt-2 font-medium">{t.auth.mfa.step2}</p>
        </div>
      )}
      {mode === "verify" && <ShieldCheck className="text-primary mx-auto size-10" />}
      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={onComplete}
        disabled={submit.isPending}
      />
      <Button
        className="h-9"
        disabled={code.length !== 6 || submit.isPending}
        onClick={() => onComplete(code)}
      >
        {submit.isPending && <Spinner />}
        {mode === "setup" ? t.auth.mfa.enable : t.auth.mfa.submit}
      </Button>
    </AuthCard>
  );
}

export default function MfaPage() {
  return (
    <div className="bg-muted/30 flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Logo />
      <div className="w-full max-w-sm">
        <Suspense>
          <MfaFlow />
        </Suspense>
      </div>
    </div>
  );
}
