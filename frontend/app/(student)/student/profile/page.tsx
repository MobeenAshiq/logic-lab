"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, PageHeader, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { useMe } from "@/lib/auth";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, t.auth.passwordHint)
      .max(72)
      .regex(/[A-Za-z]/, t.auth.passwordHint)
      .regex(/[0-9]/, t.auth.passwordHint),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type Values = z.infer<typeof schema>;

export default function ProfilePage() {
  const user = useMe().data?.user;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      toast.success("Your password has been changed.");
      form.reset();
    } catch (err) {
      applyFormErrors(err, form.setError);
    }
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{user?.fullName}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>You will stay logged in here. Other devices will be logged out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
            </Field>
            <Field label={t.auth.newPassword} htmlFor="newPassword" error={errors.newPassword?.message} hint={t.auth.passwordHint}>
              <Input id="newPassword" type="password" autoComplete="new-password" {...form.register("newPassword")} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
            </Field>
            <Button type="submit" className="h-9 justify-self-start" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
