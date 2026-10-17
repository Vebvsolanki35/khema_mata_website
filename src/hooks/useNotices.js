import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/** Postgres "undefined_table" — the migration hasn't been run yet. */
const MISSING_TABLE = "42P01";

/** Urgent -> Important -> Normal. */
const PRIORITY_RANK = { urgent: 0, important: 1, normal: 2 };

function sortNotices(list) {
  return [...list].sort((a, b) => {
    const byRank = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (byRank !== 0) return byRank;
    return (
      new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)
    );
  });
}

/**
 * Fetches the notices that are currently live on the public site.
 *
 * Only notices that are published, inside their schedule window and not yet
 * expired are returned. Drafts, scheduled-but-not-yet-published and archived
 * notices stay invisible here — that is enforced by the RLS policy in
 * supabase/migrations, not by this query.
 *
 * If the `notices` table does not exist yet the hook reports `missing: true`
 * instead of surfacing a raw database error, so the homepage can show the
 * neutral "no new official notices" message.
 *
 * The fetch uses .then() so all state updates happen in a promise callback and
 * the effect below never sets state synchronously.
 */
export function useNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(
    () =>
      supabase
        .from("notices")
        .select("*")
        .eq("status", "published")
        .eq("is_published", true)
        // published_at null => already live; otherwise only once the time arrives
        .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`)
        .order("published_at", { ascending: false, nullsFirst: false })
        .then(({ data, error }) => {
          if (error) {
            // Missing table (migration not run) or any other failure: fall back
            // to the neutral message rather than breaking the homepage.
            setNotices([]);
            setMissing(true);
            setLoading(false);
            return;
          }

          // Expiry is filtered here too, so a notice can never linger on the
          // page after it has expired.
          const now = Date.now();
          const live = (data || []).filter((n) => {
            if (n.expires_at && new Date(n.expires_at).getTime() <= now) return false;
            return true;
          });

          setNotices(sortNotices(live));
          setMissing(error?.code === MISSING_TABLE);
          setLoading(false);
        }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  return { notices, loading, missing, reload: load };
}

export default useNotices;
