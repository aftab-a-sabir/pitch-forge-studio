import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
import { listProjects } from "@/lib/projects.functions";
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
};

function ProjectsPage() {
  const checking = useRequireAuth();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const fetchProjects = useServerFn(listProjects);

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
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
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
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}