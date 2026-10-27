"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { t } from "@/lib/i18n";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4">{children}</CardContent>
      </Card>
      {footer && <p className="text-muted-foreground mt-4 text-center text-sm">{footer}</p>}
    </>
  );
}

export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Explains why the user landed on /login (session expired, banned, Google error...). */
export function reasonMessage(code: string | null) {
  return code ? (t.auth.reasons[code] ?? null) : null;
}

export function GoogleButton() {
  return (
    <>
      {/* Full-page navigation: the OAuth flow is a chain of redirects. */}
      <Button variant="outline" className="w-full" asChild>
        <a href="/api/auth/google">
          <svg viewBox="0 0 24 24" aria-hidden className="size-4">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
            />
          </svg>
          {t.auth.google}
        </a>
      </Button>
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        {t.auth.orContinueWith}
        <span className="bg-border h-px flex-1" />
      </div>
    </>
  );
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled}
        inputMode="numeric"
        pattern="^[0-9]*$"
        autoFocus
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot key={i} index={i} className="size-11 text-base" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}
