import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type Mode = "signin" | "signup";

export default function SignIn() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [programName, setProgramName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Redirect already-authenticated users away from the sign-in page. Parents
  // go straight to /parent-portal — sending them to /dashboard (the staff
  // operations view) first meant every one of that page's queries failed
  // auth for a parent session and it never stopped showing loading skeletons.
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = (user as { role?: string }).role === "parent" ? "/parent-portal" : "/dashboard";
    }
  }, [authLoading, user]);

  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    const isSignup = mode === "signup";
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    if (isSignup && (!programName.trim() || !name.trim())) { setError("Program name and your name are required."); return; }
    if (isSignup && password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const res = await fetch(isSignup ? "/api/auth/web-signup" : "/api/auth/web-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(isSignup ? { programName, name, email, password } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Something went wrong. Please try again."); return; }
      // Full navigation so the new session cookie is picked up server-side.
      // Parent accounts land on /parent-portal, not the staff dashboard —
      // web-signup always creates an admin account, but existing parent
      // accounts sign in through this same form and need the right home page.
      window.location.href = data?.role === "parent" ? "/parent-portal" : "/dashboard";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src="/brand/logo-mark-192.png" alt="Sprout" className="w-16 h-16 rounded-2xl" />
          <span className="font-bold text-4xl tracking-tight text-foreground">Sprout</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{mode === "signin" ? "Sign in" : "Create your program"}</CardTitle>
            <CardDescription>
              {mode === "signin" ? "Welcome back. Sign in to your program." : "Start a new program on Sprout — you'll be its administrator."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2"><Label>Program name</Label><Input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Sunshine Preschool" /></div>
                <div className="space-y-2"><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
              </>
            )}
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@program.org" onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"} onKeyDown={(e) => e.key === "Enter" && submit()} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full gap-2" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{mode === "signin" ? "Sign in" : "Create program"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {mode === "signin" ? (
                <>New program? <button className="text-primary font-medium" onClick={() => { setMode("signup"); setError(null); }}>Create an account</button></>
              ) : (
                <>Already have an account? <button className="text-primary font-medium" onClick={() => { setMode("signin"); setError(null); }}>Sign in</button></>
              )}
            </p>
            <p className="text-center text-xs text-muted-foreground">
              Prefer we set you up? <Link href="/request-program"><span className="text-primary font-medium cursor-pointer">Request a program</span></Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
