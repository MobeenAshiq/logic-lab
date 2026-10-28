"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, FormAlert, GoogleButton, reasonMessage } from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import { afterLoginPath, ME_KEY, useMe } from "@/lib/auth";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { SessionResponse } from "@/types/api";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});
type Values = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [error, setError] = useState<string | null>(
    reasonMessage(params.get("reason") ?? params.get("error")),
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (me) {
      router.replace(afterLoginPath(me.user.role, me.mfa, params.get("next")));
    }
  }, [me, router, params]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setUnverifiedEmail(null);
    try {
      const session = await api<SessionResponse>("/auth/login", { method: "POST", body: values });
      queryClient.setQueryData(ME_KEY, session);
      router.replace(afterLoginPath(session.user.role, session.mfa, params.get("next")));
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED")
        setUnverifiedEmail(values.email);
      setError(errorMessage(err));
    }
  });

  const verifyNow = async () => {
    if (!unverifiedEmail) return;
    await api("/auth/resend-code", { method: "POST", body: { email: unverifiedEmail } }).catch(
      () => {},
    );
    router.push(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`);
  };

  return (
    <AuthCard
      title={t.auth.login.title}
      subtitle={t.auth.login.subtitle}
      footer={
        <>
          {t.auth.login.noAccount}{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            {t.auth.login.createAccount}
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormAlert message={error} />
        {unverifiedEmail && (
          <Button type="button" variant="outline" onClick={verifyNow}>
            {t.auth.login.resendCode}
          </Button>
        )}
        <Field label={t.auth.email} htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field
          label={t.auth.password}
          htmlFor="password"
          error={form.formState.errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </Field>
        <div className="-mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {t.auth.login.forgot}
          </Link>
        </div>
        <Button type="submit" className="h-9" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t.auth.login.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
