"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AuthCard, FormAlert } from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";

const schema = z.object({
  password: z
    .string()
    .min(8, t.auth.passwordHint)
    .max(72)
    .regex(/[A-Za-z]/, t.auth.passwordHint)
    .regex(/[0-9]/, t.auth.passwordHint),
});

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState<string | null>(token ? null : t.auth.reset.missingToken);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      toast.success(t.auth.reset.done);
      router.replace("/login");
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthCard
      title={t.auth.reset.title}
      footer={
        <Link href="/forgot-password" className="text-primary font-medium hover:underline">
          {t.auth.forgot.title}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormAlert message={error} />
        <Field
          label={t.auth.newPassword}
          htmlFor="password"
          error={form.formState.errors.password?.message}
          hint={t.auth.passwordHint}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </Field>
        <Button type="submit" className="h-9" disabled={!token || form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t.auth.reset.submit}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
