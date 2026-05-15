import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getProject } from "@/lib/projects.functions";
import { generateScript, saveScript } from "@/lib/script.functions";
import { generateProjectVideo } from "@/lib/heygen.functions";
import { targetWordCount } from "@/lib/heygen-prompt";

export const Route = createFileRoute("/projects/$projectId/script")({
  component: ScriptPreviewPage,
});

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function ScriptPreviewPage() {
  const checking = useRequireAuth();
  const navigate = useNavigate();
  const { projectId } = Route.useParams();
  const fetchProject = useServerFn(getProject);
  const regenerate = useServerFn(generateScript);
  const persist = useServerFn(saveScript);
  const startRender = useServerFn(generateProjectVideo);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [productUrl, setProductUrl] = useState("");
  const [persona, setPersona] = useState("");
  const [seconds, setSeconds] = useState(45);
  const [headshot, setHeadshot] = useState<string | null>(null);
  const [script, setScript] = useState("");
  const [target, setTarget] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { project } = await fetchProject({ data: { projectId } });
        if (cancelled) return;
        setProductUrl(project.product_url);
        setPersona(project.target_persona);
        setSeconds(project.video_length_seconds);
        setHeadshot(project.headshot_url ?? null);
        setTarget(targetWordCount(project.video_length_seconds));
        const stored = (project as { script?: string | null }).script ?? "";
        if (stored.trim()) {
          setScript(stored);
          setLoading(false);
          return;
        }
        // No stored script yet — generate the first draft.
        setGenerating(true);
        try {
          const res = await regenerate({ data: { projectId } });
          if (!cancelled) setScript(res.script);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to generate script");
        } finally {
          if (!cancelled) setGenerating(false);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fetchProject, regenerate]);

  const onRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await regenerate({ data: { projectId } });
      setScript(res.script);
      toast.success(`Regenerated (${res.words} words)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate");
    } finally {
      setGenerating(false);
    }
  };

  const onRender = async () => {
    setRendering(true);
    try {
      // Save any edits first.
      await persist({ data: { projectId, script } });
      await startRender({ data: { projectId } });
      toast.success("Video generation started");
      navigate({ to: "/projects" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start render");
    } finally {
      setRendering(false);
    }
  };

  const words = countWords(script);
  const estSeconds = Math.round(words / 2.7);

  if (checking || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            to="/"
            className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
          >
            PitchForge Studio
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <Link to="/new" className="text-muted-foreground hover:text-foreground">
              New Project
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Review the script
        </h1>
        <p className="mt-2 text-muted-foreground">
          The avatar will read this verbatim. Edit it freely, regenerate, or send it to render.
        </p>

        <div className="mt-6 rounded-lg border bg-card p-4 text-sm text-muted-foreground space-y-1">
          <div>
            <span className="text-foreground font-medium">Product:</span>{" "}
            <a href={productUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {productUrl}
            </a>
          </div>
          <div>
            <span className="text-foreground font-medium">Persona:</span> {persona}
          </div>
          <div>
            <span className="text-foreground font-medium">Target length:</span>{" "}
            {seconds}s (~{target} words)
          </div>
          {headshot ? <div className="text-xs">Avatar IV (presenter photo supplied)</div> : null}
        </div>

        <div className="mt-6 space-y-2">
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={14}
            placeholder={generating ? "Generating script…" : "Script will appear here"}
            disabled={generating}
            className="font-sans text-base leading-relaxed"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {words} words · ~{estSeconds}s spoken
            </span>
            <span>Target ~{target} words</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onRender}
            disabled={rendering || generating || !script.trim()}
            className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20"
          >
            {rendering ? "Starting render…" : "Looks good — render video"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRegenerate}
            disabled={generating || rendering}
          >
            {generating ? "Regenerating…" : "Regenerate"}
          </Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/projects">Back to projects</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}