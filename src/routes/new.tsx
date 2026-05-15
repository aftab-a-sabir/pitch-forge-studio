import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/new")({
  component: NewProjectPage,
});

type StoredProject = {
  id: string;
  name: string;
  productUrl: string;
  personas: string;
  createdAt: string;
  status: string;
};

function NewProjectPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [personas, setPersonas] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project: StoredProject = {
      id: crypto.randomUUID(),
      name,
      productUrl,
      personas,
      createdAt: new Date().toISOString(),
      status: "Generating",
    };
    const existing = JSON.parse(localStorage.getItem("pitchforge_projects") || "[]");
    localStorage.setItem("pitchforge_projects", JSON.stringify([project, ...existing]));
    navigate({ to: "/projects" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold">PitchForge Studio</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
            <Link to="/new" className="text-muted-foreground hover:text-foreground">New Project</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
        <p className="mt-2 text-muted-foreground">Generate AI avatar sales videos for your product.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Q1 Launch" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">Product URL</Label>
            <Input id="url" type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} required placeholder="https://yourproduct.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personas">Target personas</Label>
            <Textarea id="personas" value={personas} onChange={(e) => setPersonas(e.target.value)} placeholder="e.g. Solo founders, Marketing managers, SMB owners" rows={4} />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Create project</Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/projects">Cancel</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}