import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { createHeygenSession, generateProjectVideo } from "@/lib/heygen.functions";

export const Route = createFileRoute("/dev/heygen-test")({
  component: HeygenTestPage,
});

function HeygenTestPage() {
  const checking = useRequireAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const runFixed = useServerFn(createHeygenSession);
  const runProject = useServerFn(generateProjectVideo);

  if (checking) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  const fixedPrompt =
    "Create a 30-second sales video for the SaaS product at https://example.com, " +
    "speaking to a Founder, in English, in a friendly yet confident tone. " +
    "Explain the main benefits clearly.";

  const handleFixed = async () => {
    setLoading("fixed"); setError(null); setResult(null);
    try {
      const r = await runFixed({ data: { prompt: fixedPrompt } });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(null); }
  };

  const handleFirstProject = async () => {
    setLoading("project"); setError(null); setResult(null);
    try {
      const { data, error: dbErr } = await supabase
        .from("projects")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dbErr) throw new Error(dbErr.message);
      if (!data) throw new Error("No projects found. Create one at /new first.");
      const r = await runProject({ data: { projectId: data.id } });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(null); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">HeyGen Test (dev)</h1>
        <p className="text-sm text-muted-foreground">
          Temporary page to verify HeyGen connectivity and the projects → prompt → API wiring.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleFixed} disabled={loading !== null}>
          {loading === "fixed" ? "Running…" : "Run fixed prompt"}
        </Button>
        <Button variant="secondary" onClick={handleFirstProject} disabled={loading !== null}>
          {loading === "project" ? "Running…" : "Run with first project"}
        </Button>
      </div>
      {error && (
        <div className="rounded border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {result !== null && (
        <pre className="overflow-auto rounded border bg-muted p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}