import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { supabase } from "@/integrations/supabase/client";
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
  name: string;
  productUrl: string;
  personas: string;
  createdAt: string;
  status: string;
};

function ProjectsPage() {
  const checking = useRequireAuth();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setProjects(JSON.parse(localStorage.getItem("pitchforge_projects") || "[]"));
  }, []);

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
    })();
    return () => { cancelled = true; };
  }, [checking]);

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
                <TableHead>Name</TableHead>
                <TableHead>Product URL</TableHead>
                <TableHead>Personas</TableHead>
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
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <a href={p.productUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {p.productUrl}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{p.personas || "—"}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
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