import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { createProject, updateProject, getProject, TARGET_PERSONAS } from "@/lib/projects.functions";
import { DEMO_HEADSHOT_URL, HEYGEN_VOICES } from "@/lib/heygen-config";
import { supabase } from "@/integrations/supabase/client";
import {
  SELECTABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  MULTI_SELECT_LANGUAGES,
  type Language,
} from "@/lib/languages";

export const Route = createFileRoute("/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
  component: NewProjectPage,
});

const formSchema = z.object({
  product_url: z.string().url("Enter a valid URL"),
  product_summary: z.string().max(5000).optional(),
  target_persona: z.enum(TARGET_PERSONAS),
  target_languages: z.array(z.string()).min(1, "Select at least one language"),
  video_length_seconds: z.number().int().min(15).max(120),
  headshot_url: z.string().url().optional().nullable(),
  voice_id: z.string().min(1).max(128).optional().nullable(),
});

function NewProjectPage() {
  const checking = useRequireAuth();
  const navigate = useNavigate();
  const { edit: editId } = Route.useSearch();
  const create = useServerFn(createProject);
  const update = useServerFn(updateProject);
  const fetchProject = useServerFn(getProject);
  const isEdit = !!editId;

  const [productUrl, setProductUrl] = useState("");
  const [productSummary, setProductSummary] = useState("");
  const [persona, setPersona] = useState<string>("");
  const [languages, setLanguages] = useState<Language[]>([DEFAULT_LANGUAGE]);
  const [lengthSec, setLengthSec] = useState<number>(45);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [headshotTab, setHeadshotTab] = useState<"none" | "url" | "upload" | "demo">("none");
  const [headshotUrlInput, setHeadshotUrlInput] = useState("");
  const [headshotFile, setHeadshotFile] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const [loadingProject, setLoadingProject] = useState<boolean>(isEdit);
  const [voiceChoice, setVoiceChoice] = useState<string>("__default__");
  const [customVoiceId, setCustomVoiceId] = useState<string>("");

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const { project } = await fetchProject({ data: { projectId: editId } });
        if (cancelled) return;
        setProductUrl(project.product_url ?? "");
        setProductSummary(project.product_summary ?? "");
        setPersona(project.target_persona ?? "");
        setLanguages((project.target_languages ?? [DEFAULT_LANGUAGE]) as Language[]);
        setLengthSec(project.video_length_seconds ?? 45);
        const pv = project.voice_id ?? null;
        if (!pv) {
          setVoiceChoice("__default__");
        } else if (HEYGEN_VOICES.some((v) => v.id === pv)) {
          setVoiceChoice(pv);
        } else {
          setVoiceChoice("__custom__");
          setCustomVoiceId(pv);
        }
        if (project.headshot_url) {
          if (project.headshot_url === DEMO_HEADSHOT_URL) {
            setHeadshotTab("demo");
          } else {
            setHeadshotTab("url");
            setHeadshotUrlInput(project.headshot_url);
          }
          setHeadshotPreview(project.headshot_url);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoadingProject(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, fetchProject]);

  if (checking || loadingProject) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const onTabChange = (value: string) => {
    const v = value as "none" | "url" | "upload" | "demo";
    setHeadshotTab(v);
    setHeadshotUrlInput("");
    setHeadshotFile(null);
    setHeadshotPreview(v === "demo" ? DEMO_HEADSHOT_URL : null);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setHeadshotFile(file);
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Headshot must be 5MB or smaller");
        setHeadshotFile(null);
        setHeadshotPreview(null);
        e.target.value = "";
        return;
      }
      setHeadshotPreview(URL.createObjectURL(file));
    } else {
      setHeadshotPreview(null);
    }
  };

  const resolveHeadshotUrl = async (): Promise<string | null> => {
    if (headshotTab === "url") return headshotUrlInput.trim() || null;
    if (headshotTab === "demo") return DEMO_HEADSHOT_URL;
    if (headshotTab === "upload" && headshotFile) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;
      const ext = headshotFile.name.split(".").pop() || "jpg";
      const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${safeExt}`;
      const { error: uploadErr } = await supabase.storage
        .from("headshots")
        .upload(path, headshotFile, { contentType: headshotFile.type, upsert: false });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data: pub } = supabase.storage.from("headshots").getPublicUrl(path);
      return pub.publicUrl;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    let headshotUrl: string | null = null;
    try {
      headshotUrl = await resolveHeadshotUrl();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload headshot");
      return;
    }
    let voiceId: string | null = null;
    if (voiceChoice === "__custom__") {
      const trimmed = customVoiceId.trim();
      if (!trimmed) {
        setErrors({ voice_id: "Enter a voice_id or pick a voice from the list" });
        return;
      }
      voiceId = trimmed;
    } else if (voiceChoice !== "__default__") {
      voiceId = voiceChoice;
    }
    const parsed = formSchema.safeParse({
      product_url: productUrl,
      product_summary: productSummary || undefined,
      target_persona: persona,
      target_languages: languages,
      video_length_seconds: lengthSec,
      headshot_url: headshotUrl ?? undefined,
      voice_id: voiceId ?? undefined,
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
      if (isEdit && editId) {
        await update({ data: { ...parsed.data, projectId: editId } });
        toast.success("Project updated");
      } else {
        await create({ data: parsed.data });
        toast.success("Project created");
      }
      navigate({ to: "/projects" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isEdit ? "Failed to update project" : "Failed to create project");
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
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{isEdit ? "Edit Project" : "New Project"}</h1>
        <p className="mt-2 text-muted-foreground">{isEdit ? "Update your project details." : "Generate AI avatar sales videos for your product."}</p>

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
            <Label htmlFor="voice_id">Voice</Label>
            <Select value={voiceChoice} onValueChange={setVoiceChoice}>
              <SelectTrigger id="voice_id">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default (English – Female)</SelectItem>
                {HEYGEN_VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
                <SelectItem value="__custom__">Other — paste voice_id</SelectItem>
              </SelectContent>
            </Select>
            {voiceChoice === "__custom__" && (
              <Input
                placeholder="HeyGen voice_id (from /v2/voices)"
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Used when a presenter headshot is provided (Avatar IV).
            </p>
            {errors.voice_id && <p className="text-sm text-destructive">{errors.voice_id}</p>}
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

          <div className="space-y-2">
            <Label>Presenter headshot (optional)</Label>
            <p className="text-xs text-muted-foreground">
              When provided, the video uses HeyGen Avatar IV with this photo instead of a default avatar.
            </p>
            <Tabs value={headshotTab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="none">None</TabsTrigger>
                <TabsTrigger value="url">URL</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="demo">Demo</TabsTrigger>
              </TabsList>
              <TabsContent value="none">
                <p className="text-xs text-muted-foreground py-2">No headshot — use HeyGen's default avatar.</p>
              </TabsContent>
              <TabsContent value="url" className="space-y-2">
                <Input
                  type="url"
                  placeholder="https://example.com/headshot.jpg"
                  value={headshotUrlInput}
                  onChange={(e) => {
                    setHeadshotUrlInput(e.target.value);
                    setHeadshotPreview(e.target.value || null);
                  }}
                />
              </TabsContent>
              <TabsContent value="upload" className="space-y-2">
                <Input type="file" accept="image/png,image/jpeg" onChange={onFileChange} />
                <p className="text-xs text-muted-foreground">PNG or JPEG, up to 5MB.</p>
              </TabsContent>
              <TabsContent value="demo">
                <p className="text-xs text-muted-foreground py-2">Use the bundled demo headshot.</p>
              </TabsContent>
            </Tabs>
            {headshotPreview && (
              <img
                src={headshotPreview}
                alt="Headshot preview"
                className="mt-2 h-24 w-24 rounded-md object-cover border"
                onError={() => {
                  // ignore broken url previews
                }}
              />
            )}
            {errors.headshot_url && <p className="text-sm text-destructive">{errors.headshot_url}</p>}
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20"
            >
              {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save changes" : "Create project")}
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
