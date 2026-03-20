import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useContactForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const submit = async ({ name, phone, message }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: err } = await supabase
      .from("contact_messages")
      .insert([{ name, phone, message }]);

    setLoading(false);
    if (err) {
      setError(err.message);
      return false;
    }
    setSuccess(true);
    return true;
  };

  return { submit, loading, success, error };
}
