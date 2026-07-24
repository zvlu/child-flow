import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const BLANK = { organizationName: "", agencyId: "", contactName: "", contactEmail: "", phone: "", message: "" };

export default function RequestProgram() {
  const [form, setForm] = useState({ ...BLANK });
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = trpc.programRequests.create.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => toast.error(e.message || "Could not submit your request"),
  });

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.contactEmail.trim());
  const canSubmit = form.organizationName.trim() && form.contactName.trim() && emailOk;

  const submit = () => {
    if (!canSubmit) { toast.error("Program name, your name, and a valid email are required."); return; }
    create.mutate({
      organizationName: form.organizationName.trim(),
      agencyId: form.agencyId.trim() || undefined,
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      phone: form.phone.trim() || undefined,
      message: form.message.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-6">
          <img src="/brand/logo-mark-192.png" alt="Sprout" className="w-14 h-14 rounded-2xl" />
          <span className="font-bold text-lg tracking-tight text-foreground">Sprout</span>
        </div>

        {done ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
              <h2 className="text-xl font-bold text-foreground">Request received</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Thanks, {form.contactName.split(" ")[0] || "there"}. Our team will review {form.organizationName} and reach out at {form.contactEmail}.
              </p>
              <Link href="/"><Button variant="outline" className="gap-2 mt-2"><ArrowLeft className="h-4 w-4" />Back to home</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Request a program</CardTitle>
              <CardDescription>Tell us about your school, center, or program — Head Start, Early Head Start, preschool, or child care — and we'll get you set up on Sprout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Program name *</Label><Input placeholder="Sunshine Preschool" value={form.organizationName} onChange={set("organizationName")} /></div>
                <div className="space-y-2"><Label>Agency ID (optional)</Label><Input placeholder="Head Start grantee ID or your internal ID" value={form.agencyId} onChange={set("agencyId")} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Your name *</Label><Input placeholder="Full name" value={form.contactName} onChange={set("contactName")} /></div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" placeholder="you@program.org" value={form.contactEmail} onChange={set("contactEmail")} /></div>
              </div>
              <div className="space-y-2"><Label>Phone (optional)</Label><Input placeholder="(555) 000-0000" value={form.phone} onChange={set("phone")} /></div>
              <div className="space-y-2">
                <Label>Anything else? (optional)</Label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={set("message")}
                  placeholder="Number of children, locations, timeline…"
                  className="w-full rounded-lg border border-border bg-background p-3 text-sm"
                />
              </div>
              <Button className="w-full gap-2" disabled={!canSubmit || create.isPending} onClick={submit}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Submit request
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have an account? <Link href="/"><span className="text-primary font-medium cursor-pointer">Sign in</span></Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
