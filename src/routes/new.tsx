import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { createProject, TARGET_PERSONAS } from "@/lib/projects.functions";
import {
  SELECTABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  MULTI_SELECT_LANGUAGES,
  type Language,
} from "@/lib/languages";

export const Route = createFileRoute("/new")({
  component: NewProjectPage,
});

const formSchema = z.object({
  product_url: z.string().url("Enter a valid URL"),
  product_summary: z.string().max(5000).optional(),
  target_persona: z.enum(TARGET_PERSONAS),
  target_languages: z.array(z.string()).min(1, "Select at least one language"),
  video_length_seconds: z.number().int().min(15).max(120),
});

function NewProjectPage() {
  const checking = useRequireAuth();
  const navigate = useNavigate();
  const create = useServerFn(createProject);

  const [productUrl, setProductUrl] = useState("");
  const [productSummary, setProductSummary] = useState("");
  const [persona, setPersona] = useState<string>("");
  const [languages, setLanguages] = useState<Language[]>([DEFAULT_LANGUAGE]);
  const [lengthSec, setLengthSec] = useState<number>(45);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = formSchema.safeParse({
      product_url: productUrl,
      product_summary: productSummary || undefined,
      target_persona: persona,
      target_languages: languages,
      video_length_seconds: lengthSec,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join(".");
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await create({ data: parsed.data });
      toast.success("Project created");
      navigate({ to: "/projects" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">PitchForge Studio</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
            <Link to="/new" className="text-muted-foreground hover:text-foreground">New Project</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">New Project</h1>
        <p className="mt-2 text-muted-foreground">Generate AI avatar sales videos for your product.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="product_url">Product URL</Label>
            <Input
              id="product_url"
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://yourproduct.com"
              required
            />
            {errors.product_url && <p className="text-sm text-destructive">{errors.product_url}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_summary">Product summary (optional)</Label>
            <Textarea
              id="product_summary"
              value={productSummary}
              onChange={(e) => setProductSummary(e.target.value)}
              placeholder="Optional fallback description in case URL parsing fails."
              rows={4}
            />
            {errors.product_summary && <p className="text-sm text-destructive">{errors.product_summary}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_persona">Target persona</Label>
            <Select value={persona} onValueChange={setPersona}>
              <SelectTrigger id="target_persona">
                <SelectValue placeholder="Select a persona" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_PERSONAS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.target_persona && <p className="text-sm text-destructive">{errors.target_persona}</p>}
          </div>

          <div className="space-y-2">
            <Label>Target language{MULTI_SELECT_LANGUAGES ? "s" : ""}</Label>
            {MULTI_SELECT_LANGUAGES ? (
              <ToggleGroup
                type="multiple"
                value={languages}
                onValueChange={(vals) => setLanguages((vals as Language[]).length ? (vals as Language[]) : [DEFAULT_LANGUAGE])}
                className="justify-start flex-wrap"
              >
                {SELECTABLE_LANGUAGES.map((lang) => (
                  <ToggleGroupItem key={lang} value={lang} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {lang}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <Select
                value={languages[0]}
                onValueChange={(v) => setLanguages([v as Language])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.target_languages && <p className="text-sm text-destructive">{errors.target_languages}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="video_length_seconds">Video length (seconds)</Label>
            <Input
              id="video_length_seconds"
              type="number"
              min={15}
              max={120}
              value={lengthSec}
              onChange={(e) => setLengthSec(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Between 15 and 120 seconds. Default 45.</p>
            {errors.video_length_seconds && <p className="text-sm text-destructive">{errors.video_length_seconds}</p>}
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20"
            >
              {submitting ? "Creating…" : "Create project"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/projects">Cancel</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
