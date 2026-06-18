import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Baby, Loader2 } from "lucide-react";

type Mode = "signin" | "signup";

export default function SignIn() {
  const [mode, setMode] = useState<Mode>("signin");
  const [programName, setProgramName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      window.location.href = "/dashboard";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF6EE] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center"><Baby className="h-5 w-5 text-primary" /></div>
          <span className="font-bold text-lg tracking-tight text-foreground">Sprout</span>
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
                <div className="space-y-2"><Label>Program name</Label><Input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Sunshine Head Start" /></div>
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
