import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";

/** Postgres "undefined_table" — the migration hasn't been run yet. */
const MISSING_TABLE = "42P01";
/** Postgres "check_violation" — e.g. the contact method had no value. */
const CHECK_VIOLATION = "23514";

/**
 * Submits a seva / volunteer interest application.
 *
 * IMPORTANT: `success` is only set to true when Supabase confirms the row was
 * written. A network failure or a rejected insert surfaces as `error` so the
 * form can tell the visitor the application was NOT saved — it never silently
 * discards a submission while appearing to succeed.
 *
 * Only the fields needed to reply to the applicant are sent. No identity
 * documents, bank or payment details are ever collected or transmitted.
 */
export function useVolunteerApplication() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(async (values) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const payload = {
      full_name: values.fullName.trim(),
      contact_method: values.contactMethod,
      mobile: values.contactMethod === "mobile" ? values.mobile.trim() : null,
      email: values.contactMethod === "email" ? values.email.trim() : null,
      activity: values.activity,
      availability_date: values.availabilityDate || null,
      availability_note: values.availabilityNote?.trim() || null,
      city: values.city?.trim() || null,
      message: values.message?.trim() || null,
      // Status is set explicitly rather than relying on the column default, so
      // the intent is obvious in the client as well as the schema.
      status: "pending",
    };

    const { data, error: err } = await supabase
      .from("volunteer_applications")
      .insert([payload])
      .select("id")
      .single();

    setLoading(false);

    if (err) {
      // Preserve the real message; the UI adds a plain-language explanation.
      setError({ message: err.message, code: err.code, missing: err.code === MISSING_TABLE });
      return { ok: false, error: err };
    }

    if (!data) {
      // Insert appeared to succeed but nothing came back — treat as failure so
      // we never report success without backend confirmation.
      setError({ message: "no-confirmation", code: null, missing: false });
      return { ok: false, error: new Error("no-confirmation") };
    }

    setSuccess(true);
    return { ok: true, id: data.id };
  }, []);

  const reset = useCallback(() => {
    setSuccess(false);
    setError(null);
    setLoading(false);
  }, []);

  return { submit, reset, loading, success, error, CHECK_VIOLATION };
}

export default useVolunteerApplication;
