import { useEffect, useState } from "react";
import { untypedDb } from "@/integrations/supabase/untyped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
type AuditLog = {
  id: string;
  user_id: string;
  role: string;
  action_performed: string;
  record_id: string | null;
  table_name: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};
export default function ComplianceAuditLogs() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const [next, setNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void Promise.resolve(
      untypedDb.rpc("search_audit_logs", {
        _search: search,
        _action: "all",
        _date: date || null,
        _offset: page * 100,
      }),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(true);
          return;
        }
        const records = (data || []) as AuditLog[];
        setNext(records.length > 100);
        setRows(records.slice(0, 100));
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, date, page, attempt]);
  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-semibold">Audit trail</h1>
      <p>
        Search across all retained records. Dates use UTC. Results are
        paginated, newest first.
      </p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
          setPage(0);
        }}
      >
        <Input
          aria-label="Search audit records"
          className="max-w-lg"
          placeholder="User, action, record ID or role"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          Date (UTC)
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {loading ? (
        <p role="status">Loading audit records…</p>
      ) : error ? (
        <div role="alert">
          <p>Audit records could not load.</p>
          <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-4 space-y-2">
                <p className="font-medium">
                  {row.action_performed} · {row.role}
                </p>
                <p className="text-sm break-all">
                  {new Date(row.created_at).toLocaleString()} · User{" "}
                  {row.user_id} · {row.table_name} · Record{" "}
                  {row.record_id || "—"}
                </p>
                <details>
                  <summary className="cursor-pointer">
                    View change details
                  </summary>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
                    {JSON.stringify(
                      { old: row.old_value, new: row.new_value },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))}
          {!rows.length && <p>No matching audit records.</p>}
        </div>
      )}
      <nav aria-label="Audit result pages" className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 0 || loading}
          onClick={() => setPage((v) => v - 1)}
        >
          Previous
        </Button>
        <span>Page {page + 1}</span>
        <Button
          variant="outline"
          disabled={!next || loading || error}
          onClick={() => setPage((v) => v + 1)}
        >
          Next
        </Button>
      </nav>
    </main>
  );
}
