import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useDonation() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const donate = async ({ donor_name, amount }) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const { error: err } = await supabase
      .from("donations")
      .insert([{ donor_name, amount }]);

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  };

  return { donate, loading, success, error };
}
