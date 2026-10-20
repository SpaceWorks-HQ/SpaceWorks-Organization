"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/display";
import { Field, Input } from "@/components/ui/field";

/** The second sign-in step for accounts with two-step verification. */
export function MfaStep({
  email,
  code,
  onCodeChange,
  error,
  verifying,
  disabled,
  onSubmit,
  onUseDifferentAccount,
}: {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  error: string | null;
  verifying: boolean;
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUseDifferentAccount: () => void;
}) {
  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-h2 text-ink">Verify it&apos;s you</h2>
        <p className="text-body-ui text-ink-secondary">Enter the code from your authenticator app for {email}.</p>
      </div>
      {error ? <Callout tone="danger" role="alert">{error}</Callout> : null}
      <Field label="Authenticator or recovery code" required helperText="Use a six-digit authenticator code or a recovery code.">
        <Input autoFocus value={code} onChange={(e) => onCodeChange(e.target.value)} autoComplete="one-time-code" />
      </Field>
      <Button type="submit" variant="primary" size="lg" fullWidth disabled={disabled}>
        {verifying ? "Verifying…" : "Verify and sign in"}
      </Button>
      <Button variant="quiet" className="self-center" disabled={disabled} onClick={onUseDifferentAccount}>
        Use a different account
      </Button>
    </form>
  );
}

/** Words for the error codes Auth.js and our callbacks send back to /login. */
export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "google_account_required") return "Create an account with your email and password before continuing with that provider.";
  if (code === "account_creation_disabled") return "New account creation is currently unavailable. Ask an administrator for access or sign in with an existing account.";
  if (code === "unverified_email") return "That account's email address isn't verified with the provider. Verify it there, or sign in with your email and password.";
  return "Sign-in could not be completed. Try again, or use your password and verify your email first.";
}
