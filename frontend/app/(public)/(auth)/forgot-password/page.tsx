"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, FormAlert } from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";

const schema = z.object({ email: z.email() });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: values });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  });

  return (
    <AuthCard
      title={t.auth.forgot.title}
      subtitle={sent ? undefined : t.auth.forgot.subtitle}
      footer={
        <Link href="/login" className="text-primary font-medium hover:underline">
          {t.auth.forgot.back}
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 text-center text-sm">
          <CheckCircle2 className="text-success size-8" />
          <p>{t.auth.forgot.sent}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormAlert message={error} />
          <Field label={t.auth.email} htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          </Field>
          <Button type="submit" className="h-9" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {t.auth.forgot.submit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
