import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { listProjects } from "@/lib/projects.functions";
import { generateProjectVideo, checkProjectStatus } from "@/lib/heygen.functions";
import { track } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

type StoredProject = {
  id: string;
  product_url: string;
  target_persona: string;
  target_languages: string[];
  video_length_seconds: number;
  status: string;
  created_at: string;
  heygen_session_id?: string | null;
  heygen_video_id?: string | null;
  heygen_last_error?: string | null;
  video_url?: string | null;
};

function ProjectsPage() {
  const checking = useRequireAuth();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<StoredProject | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const fetchProjects = useServerFn(listProjects);
  const generateVideo = useServerFn(generateProjectVideo);
  const checkStatus = useServerFn(checkProjectStatus);
  const playedRef = useRef<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetchProjects();
      setProjects(res.projects as StoredProject[]);
    } catch {
      // ignore
    }
  };

  const handleGenerate = async (projectId: string) => {
    setBusyId(projectId);
    try {
      const res = await generateVideo({ data: { projectId } });
      const proj = projects.find((p) => p.id === projectId);
      if (proj) {
        track("video_generation_started", {
          project_id: proj.id,
          persona: proj.target_persona,
          languages: proj.target_languages,
          video_length_seconds: proj.video_length_seconds,
        });
      }
      toast.success(`Video session started (${res.session_id.slice(0, 12)}…)`);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to start video";
      toast.error(msg);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const handleCheck = async (projectId: string) => {
    setCheckingId(projectId);
    try {
      const res = await checkStatus({ data: { projectId } });
      const prev = projects.find((p) => p.id === projectId);
      if (res.status === "ready") {
        toast.success("Video is ready!");
        if (prev && prev.status !== "ready") {
          track("video_generation_completed", {
            project_id: prev.id,
            persona: prev.target_persona,
            languages: prev.target_languages,
            video_length_seconds: prev.video_length_seconds,
          });
        }
      } else toast.message(`Status: ${res.status}`);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to check status";
      toast.error(msg);
    } finally {
      setCheckingId(null);
    }
  };

  useEffect(() => {
    if (checking) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setEmail(user.email ?? null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setDisplayName(profile?.display_name ?? null);
      try {
        const res = await fetchProjects();
        if (!cancelled) setProjects(res.projects as StoredProject[]);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [checking, fetchProjects]);

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const identity = displayName && email
    ? `${displayName} (${email})`
    : email ?? "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">PitchForge Studio</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
            <Link to="/new" className="text-muted-foreground hover:text-foreground">New Project</Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); }}
              className="text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome to your Projects Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              {identity ? <>You are signed in as <span className="text-foreground font-medium">{identity}</span></> : "Loading account…"}
            </p>
          </div>
          <Button asChild>
            <Link to="/new">New Project</Link>
          </Button>
        </div>
        <div className="mt-8 rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product URL</TableHead>
                <TableHead>Persona</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead>Length</TableHead>
                <TableHead>Status</TableHead>
              <TableHead>HeyGen Video</TableHead>
                <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    No projects yet. Create your first one.
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-xs truncate">
                      <a href={p.product_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {p.product_url}
                      </a>
                    </TableCell>
                    <TableCell>{p.target_persona}</TableCell>
                    <TableCell>{p.target_languages.join(", ")}</TableCell>
                    <TableCell>{p.video_length_seconds}s</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      {p.status === "error" && p.heygen_last_error ? (
                        <div className="mt-1 max-w-xs truncate text-xs text-destructive" title={p.heygen_last_error}>
                          {p.heygen_last_error}
                        </div>
                      ) : null}
                    </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.heygen_video_id ? `${p.heygen_video_id.slice(0, 12)}…` : "—"}
                  </TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {p.status === "ready" && p.video_url ? (
                        <Button size="sm" onClick={() => setPlaying(p)}>
                          Play Video
                        </Button>
                      ) : p.status === "processing" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={checkingId === p.id}
                          onClick={() => handleCheck(p.id)}
                        >
                          {checkingId === p.id ? "Checking…" : "Check for Video"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyId === p.id}
                          onClick={() => handleGenerate(p.id)}
                        >
                          {busyId === p.id ? "Starting…" : p.status === "error" ? "Retry" : "Generate video"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
      <Dialog
        open={!!playing}
        onOpenChange={(open) => {
          if (!open) {
            setPlaying(null);
            setAspect(null);
          }
        }}
      >
        <DialogContent className="p-4 w-fit max-w-[min(90vw,72rem)]">
          <DialogHeader>
            <DialogTitle className="truncate">{playing?.product_url}</DialogTitle>
          </DialogHeader>
          {playing?.video_url ? (
            <div
              className="mx-auto"
              style={
                aspect && aspect < 1
                  ? {
                      aspectRatio: aspect,
                      height: "min(80vh, calc(90vw * " + aspect + "))",
                    }
                  : {
                      aspectRatio: "16 / 9",
                      width: "min(90vw, calc(80vh * 16 / 9), 72rem)",
                    }
              }
            >
              <video
                src={playing.video_url}
                controls
                autoPlay
                className="h-full w-full rounded-md object-contain bg-black"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setAspect(v.videoWidth / v.videoHeight);
                  }
                }}
                onPlay={() => {
                if (!playing || playedRef.current === playing.id) return;
                playedRef.current = playing.id;
                track("video_played", {
                  project_id: playing.id,
                  persona: playing.target_persona,
                  languages: playing.target_languages,
                });
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "processing":
      return "secondary";
    case "error":
      return "destructive";
    default:
      return "outline";
  }
}