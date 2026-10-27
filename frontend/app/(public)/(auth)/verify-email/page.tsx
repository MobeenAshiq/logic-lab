"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard, CodeInput, FormAlert } from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { afterLoginPath, ME_KEY } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { SessionResponse } from "@/types/api";

const schema = z.object({ email: z.email(), code: z.string().regex(/^\d{6}$/) });

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailKnown = Boolean(params.get("email"));

  const verify = async (value = code) => {
    const parsed = schema.safeParse({ email, code: value });
    if (!parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api<SessionResponse>("/auth/verify-email", {
        method: "POST",
        body: parsed.data,
      });
      queryClient.setQueryData(ME_KEY, session);
      router.replace(afterLoginPath(session.user.role, session.mfa));
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await api("/auth/resend-code", { method: "POST", body: { email } });
      toast.success(t.auth.verify.resent);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard
      title={t.auth.verify.title}
      subtitle={emailKnown ? t.auth.verify.subtitle(email) : undefined}
      footer={
        <>
          {t.auth.verify.wrongEmail}{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            {t.auth.signup.title}
          </Link>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <FormAlert message={error} />
        {!emailKnown && (
          <Field label={t.auth.verify.emailLabel} htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        )}
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={(v) => void verify(v)}
          disabled={busy}
        />
        <Button type="submit" className="h-9" disabled={busy || code.length !== 6}>
          {busy && <Spinner />}
          {t.auth.verify.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={resend} disabled={!email}>
          {t.auth.verify.resend}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
