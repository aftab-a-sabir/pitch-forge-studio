import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="font-semibold">PitchForge Studio</Link>
          <div className="flex gap-4 text-sm">
            <Link to="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
            <Link to="/new" className="text-muted-foreground hover:text-foreground">New Project</Link>
          </div>
        </nav>
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">PitchForge Studio</h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Paste your product URL and get ready-to-use AI avatar sales videos for each customer persona in minutes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign up
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-accent"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
