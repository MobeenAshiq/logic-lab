import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { t } from "@/lib/i18n";

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : t.common.errors.generic;
}

/** Shows an API error as a toast. */
export function toastError(err: unknown) {
  toast.error(errorMessage(err));
}

/**
 * Puts VALIDATION_FAILED field errors on the matching form fields; anything
 * else becomes a toast. Returns true if at least one field error was set.
 */
export function applyFormErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>) {
  if (err instanceof ApiError && err.code === "VALIDATION_FAILED") {
    const fields = Object.entries(err.fieldErrors);
    for (const [field, message] of fields) {
      setError((field || "root") as Path<T>, { message });
    }
    if (fields.length > 0) return true;
  }
  toastError(err);
  return false;
}
