import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages, Loader2, MessageSquare, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ORGANIZATION_ID } from "@/const";

/** Wire shapes from server/messaging.ts (same REST API the iOS apps use). */
type Conversation = {
  id: string;
  familyName: string;
  childName: string;
  participantNames: string[];
  lastMessage: string;
  lastMessageDate: string;
  unreadCount: number;
  isActive: boolean;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: "staff" | "family";
  body: string;
  bodyOriginal?: string;
  isTranslated: boolean;
  sentAt: string;
  isRead: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Desktop thread chat with families — parity with the iOS Messages screen.
 * Polls the same REST endpoints (list 15s / open thread 5s); messages from
 * families arrive translated into the viewer's preferred language, with a
 * "show original" affordance on translated bubbles.
 */
export function FamilyChat() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [newFamilyId, setNewFamilyId] = useState<string>("");
  const [newBody, setNewBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const conversationsQuery = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => api<Conversation[]>("/api/messaging/conversations"),
    refetchInterval: 15_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["chat", "messages", selectedId],
    queryFn: () => api<ChatMessage[]>(`/api/messaging/conversations/${selectedId}/messages`),
    enabled: selectedId != null,
    refetchInterval: 5_000,
  });

  const { data: families } = trpc.families.list.useQuery(ORGANIZATION_ID);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    if (selectedId != null) queryClient.invalidateQueries({ queryKey: ["chat", "messages", selectedId] });
  };

  const sendMessage = useMutation({
    mutationFn: (body: string) =>
      api<ChatMessage>("/api/messaging/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: Number(selectedId), body }),
      }),
    onSuccess: () => {
      setDraft("");
      refreshAll();
    },
    onError: (e) => toast.error(e.message || "Message failed to send"),
  });

  const startConversation = useMutation({
    mutationFn: (input: { familyId: number; body: string }) =>
      api<{ conversationId?: string; id?: string }>("/api/messaging/conversations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (res) => {
      setNewOpen(false);
      setNewBody("");
      setNewFamilyId("");
      refreshAll();
      const id = res.conversationId ?? res.id;
      if (id != null) setSelectedId(String(id));
      toast.success("Conversation started");
    },
    onError: (e) => toast.error(e.message || "Could not start the conversation"),
  });

  const conversations = conversationsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return conversations.filter(
      (c) =>
        c.familyName.toLowerCase().includes(q) ||
        c.childName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const messages = messagesQuery.data ?? [];

  // Keep the newest message in view as threads load or grow.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, selectedId]);

  const submitDraft = () => {
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    sendMessage.mutate(body);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid min-h-[560px] grid-cols-1 md:grid-cols-[300px_1fr]">
          {/* Conversation list */}
          <div className="flex flex-col border-r border-border">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search families"
                  className="pl-9"
                />
              </div>
              <Button size="icon" variant="outline" onClick={() => setNewOpen(true)} aria-label="New conversation">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversationsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {conversations.length === 0
                    ? "No conversations yet. Start one to message a family — replies are translated automatically."
                    : "No conversations match your search."}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary/60",
                      selectedId === c.id && "bg-secondary"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{c.familyName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeLabel(c.lastMessageDate)}</span>
                    </span>
                    {c.childName && <span className="text-xs text-muted-foreground">{c.childName}</span>}
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">{c.lastMessage || "No messages yet"}</span>
                      {c.unreadCount > 0 && (
                        <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[11px]">
                          {c.unreadCount}
                        </Badge>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Thread */}
          <div className="flex flex-col">
            {selected == null ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </span>
                <div>
                  <p className="font-medium text-foreground">Pick a conversation</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Messages you send are delivered to the family app in their language, and their replies are
                    translated back for you.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selected.familyName}</p>
                    {selected.childName && <p className="text-xs text-muted-foreground">{selected.childName}</p>}
                  </div>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Languages className="h-3 w-3" /> Auto-translated
                  </Badge>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messagesQuery.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderRole === "staff";
                      const original = showOriginal[m.id];
                      return (
                        <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[75%] rounded-2xl px-4 py-2.5",
                              mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-secondary text-foreground"
                            )}
                          >
                            {!mine && <p className="mb-0.5 text-xs font-semibold opacity-80">{m.senderName}</p>}
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {original && m.bodyOriginal ? m.bodyOriginal : m.body}
                            </p>
                            <div className={cn("mt-1 flex items-center gap-2 text-[11px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                              <span>{timeLabel(m.sentAt)}</span>
                              {m.isTranslated && m.bodyOriginal && (
                                <button
                                  type="button"
                                  className="underline decoration-dotted underline-offset-2"
                                  onClick={() => setShowOriginal((s) => ({ ...s, [m.id]: !s[m.id] }))}
                                >
                                  {original ? "Show translation" : "Show original"}
                                </button>
                              )}
                              {mine && <span>{m.isRead ? "Read" : "Sent"}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="flex items-end gap-2 border-t border-border p-3">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitDraft();
                      }
                    }}
                    placeholder={`Message ${selected.familyName}… (Enter to send)`}
                    rows={2}
                    className="min-h-0 resize-none"
                  />
                  <Button onClick={submitDraft} disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message">
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* New conversation */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message a family</DialogTitle>
            <DialogDescription>
              Starts a thread with the family's app — or reopens their existing one. Your message is delivered in
              their preferred language.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newFamilyId} onValueChange={setNewFamilyId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a family" />
              </SelectTrigger>
              <SelectContent>
                {(families ?? []).map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.primaryContactName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="First message…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newFamilyId || !newBody.trim() || startConversation.isPending}
              onClick={() => startConversation.mutate({ familyId: Number(newFamilyId), body: newBody.trim() })}
            >
              {startConversation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
