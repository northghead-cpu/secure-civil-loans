import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Headset, MessageCircle, Minus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type SupportCase = {
  id: string;
  case_number: string;
  subject: string;
  status: "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
  last_message_at: string;
};
type SupportMessage = {
  id: string;
  case_id: string;
  sender_id: string;
  body: string;
  is_staff_reply: boolean;
  created_at: string;
};

const statusLabel: Record<SupportCase["status"], string> = {
  open: "Open", in_progress: "In progress", waiting_on_customer: "Awaiting your reply",
  resolved: "Resolved", closed: "Closed",
};

/**
 * Persistent customer-care entry point. Uses the same authenticated support RPCs
 * and tables as the full support desk; it does not create a separate messaging store.
 */
export default function CustomerCareChat() {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const loadCases = useCallback(async (quiet = false) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("support_cases")
      .select("id,case_number,subject,status,last_message_at")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    if (error) {
      if (!quiet) toast.error("Customer care is temporarily unavailable. Please try again.");
    } else {
      const rows = (data ?? []) as SupportCase[];
      setCases(rows);
      setCaseId((current) => current && rows.some((row) => row.id === current)
        ? current : rows[0]?.id ?? null);
    }
  }, [user]);

  const loadMessages = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    const { data, error } = await supabase
      .from("support_messages")
      .select("id,case_id,sender_id,body,is_staff_reply,created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: true });
    if (!error) setMessages((data ?? []) as SupportMessage[]);
    else if (!quiet) toast.error("Could not load this conversation.");
    if (!quiet) setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (open && user) void loadCases();
  }, [open, user, loadCases]);

  useEffect(() => {
    if (!open || !caseId) {
      setMessages([]);
      return;
    }
    void loadMessages(caseId);
    // Poll while the chat is open so staff replies appear without a manual refresh.
    const timer = window.setInterval(() => {
      void loadMessages(caseId, true);
      void loadCases(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [open, caseId, loadMessages, loadCases]);

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim() || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc("create_support_case", {
      p_subject: subject.trim(),
      p_category: "other",
      p_message: message.trim(),
    });
    if (error) {
      toast.error("Could not start a conversation. Please try again.");
    } else {
      setSubject("");
      setMessage("");
      setShowNewCase(false);
      await loadCases();
      setCaseId(data as string);
      toast.success("Message sent to customer care");
    }
    setSending(false);
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!caseId || !reply.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("reply_support_case", {
      p_case_id: caseId,
      p_message: reply.trim(),
    });
    if (error) toast.error(error.message.includes("closed") ? "This conversation is closed. Start a new one." : "Message could not be sent. Please try again.");
    else {
      setReply("");
      await Promise.all([loadMessages(caseId), loadCases(true)]);
    }
    setSending(false);
  };

  useEffect(() => {
    // Never retain a prior account's conversation if auth changes in an open tab.
    setCases([]);
    setCaseId(null);
    setMessages([]);
    setShowNewCase(false);
  }, [user?.id]);

  const selectedCase = cases.find((item) => item.id === caseId) ?? null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6" data-testid="customer-care-chat">
      {open && (
        <section aria-label="Riverbanc customer care chat" className="flex h-[min(34rem,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Headset className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Riverbanc Customer Care</p>
              <p className="text-xs text-primary-foreground/75">Send us a message</p>
            </div>
            <button type="button" aria-label="Minimise customer care chat" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-white/10"><Minus className="h-4 w-4" /></button>
            <button type="button" aria-label="Close customer care chat" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </header>

          {authLoading ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Loading secure chat…</div>
          ) : !user ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <MessageCircle className="h-10 w-10 text-primary" />
              <h2 className="font-semibold">Chat with customer care</h2>
              <p className="text-sm text-muted-foreground">Sign in to start a private conversation with the Riverbanc team.</p>
              <Link to="/login" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Sign in to chat</Link>
            </div>
          ) : showNewCase || !selectedCase ? (
            <div className="flex flex-1 flex-col">
              {cases.length > 0 && <div className="border-b border-border p-3"><button type="button" onClick={() => { setShowNewCase(false); setCaseId(cases[0].id); }} className="text-sm font-medium text-primary">← Back to conversations</button></div>}
              <form onSubmit={createCase} className="flex flex-1 flex-col gap-3 p-4">
                <h2 className="font-semibold">Start a conversation</h2>
                <label className="space-y-1 text-sm font-medium">Subject
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={5} maxLength={160} required placeholder="How can we help?" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Message
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={10000} rows={5} placeholder="Describe what you need help with…" className="w-full resize-none rounded-md border border-input bg-background p-3 text-sm font-normal" />
                </label>
                <p className="text-xs text-muted-foreground">Do not send passwords, one-time codes, or full identity documents.</p>
                <button type="submit" disabled={sending || !subject.trim() || !message.trim()} className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" />{sending ? "Sending…" : "Send to customer care"}</button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedCase.subject}</p>
                  <p className="text-xs text-muted-foreground">{selectedCase.case_number} · {statusLabel[selectedCase.status]}</p>
                </div>
                <button type="button" onClick={() => setShowNewCase(true)} className="shrink-0 text-xs font-medium text-primary">New chat</button>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite" aria-busy={loadingMessages}>
                {loadingMessages && messages.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Loading messages…</p> : messages.map((item) => (
                  <div key={item.id} className={item.is_staff_reply ? "flex justify-start" : "flex justify-end"}>
                    <div className={`max-w-[88%] rounded-xl px-3 py-2 ${item.is_staff_reply ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
                      <p className="mb-1 text-[11px] font-semibold opacity-75">{item.is_staff_reply ? "Riverbanc Customer Care" : "You"}</p>
                      <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
                      <p className="mt-1 text-right text-[10px] opacity-70">{new Intl.DateTimeFormat("en-ZM", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.created_at))}</p>
                    </div>
                  </div>
                ))}
                {!loadingMessages && messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Send a message to begin.</p>}
              </div>
              {selectedCase.status === "closed" ? (
                <div className="border-t border-border p-3"><p className="text-sm text-muted-foreground">This conversation is closed.</p><button type="button" onClick={() => setShowNewCase(true)} className="mt-2 text-sm font-medium text-primary">Start a new conversation</button></div>
              ) : (
                <form onSubmit={sendReply} className="flex items-end gap-2 border-t border-border p-3">
                  <textarea aria-label="Your message" value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={10000} required placeholder="Type your message…" className="max-h-28 min-h-10 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  <button type="submit" aria-label="Send message" disabled={sending || !reply.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
                </form>
              )}
            </>
          )}
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close customer care chat" : "Chat with customer care"} className="flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="text-sm font-semibold">{open ? "Close chat" : "Customer care"}</span>
      </button>
    </div>
  );
}
