import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionResult } from "@/lib/actions/types";

/** Push a failed action's field errors back onto the form inputs. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  result: Extract<ActionResult, { ok: false }>,
) {
  if (!result.fieldErrors) return;
  for (const [field, messages] of Object.entries(result.fieldErrors)) {
    if (messages?.length) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
    }
  }
}
