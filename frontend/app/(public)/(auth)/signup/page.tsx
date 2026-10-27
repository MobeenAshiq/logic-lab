"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, FormAlert, GoogleButton } from "@/components/auth/auth-ui";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";

// Mirrors the API's signup rules.
const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z
    .string()
    .min(8, t.auth.passwordHint)
    .max(72)
    .regex(/[A-Za-z]/, t.auth.passwordHint)
    .regex(/[0-9]/, t.auth.passwordHint),
});
type Values = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/auth/signup", { method: "POST", body: values });
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_FAILED") {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          form.setError(field as keyof Values, { message });
        }
      } else {
        setError(errorMessage(err));
      }
    }
  });

  return (
    <AuthCard
      title={t.auth.signup.title}
      subtitle={t.auth.signup.subtitle}
      footer={
        <>
          {t.auth.signup.haveAccount}{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t.auth.signup.login}
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormAlert message={error} />
        <Field
          label={t.auth.fullName}
          htmlFor="fullName"
          error={form.formState.errors.fullName?.message}
        >
          <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
        </Field>
        <Field label={t.auth.email} htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field
          label={t.auth.password}
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
        <Button type="submit" className="h-9" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t.auth.signup.submit}
        </Button>
      </form>
    </AuthCard>
  );
}
