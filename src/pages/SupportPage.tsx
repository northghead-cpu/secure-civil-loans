import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Plus, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Status = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
type Priority = "normal" | "high" | "urgent";
type Category = "account" | "kyc" | "application" | "loan_comparison" | "subscription" | "privacy" | "technical" | "other";
type SupportCase = { id: string; case_number: string; user_id: string; subject: string; category: Category; status: Status; priority: Priority; created_at: string; last_message_at: string };
type SupportMessage = { id: string; case_id: string; sender_id: string; body: string; is_staff_reply: boolean; created_at: string };
const categoryOptions: { value: Category; label: string }[] = [
  { value: "account", label: "Account access" }, { value: "kyc", label: "Identity verification (KYC)" },
  { value: "application", label: "Application status" }, { value: "loan_comparison", label: "Loan comparison" },
  { value: "subscription", label: "Subscription/payroll deduction" }, { value: "privacy", label: "Privacy and personal data" },
  { value: "technical", label: "Technical issue" }, { value: "other", label: "Other" },
];
const statusLabels: Record<Status, string> = { open: "Open", in_progress: "In progress", waiting_on_customer: "Waiting on customer", resolved: "Resolved", closed: "Closed" };
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const SupportPage = ({ staffMode = false }: { staffMode?: boolean }) => {
  const { user } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("account");
  const [initialMessage, setInitialMessage] = useState("");
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<Status>("open");
  const [priority, setPriority] = useState<Priority>("normal");
  const selected = useMemo(() => cases.find((item) => item.id === selectedId) ?? null, [cases, selectedId]);

  const loadCases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from("support_cases").select("id,case_number,user_id,subject,category,status,priority,created_at,last_message_at").order("last_message_at", { ascending: false });
    if (!staffMode) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) toast.error("Could not load support cases");
    else {
      const rows = (data ?? []) as SupportCase[];
      setCases(rows);
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    }
    setLoading(false);
  }, [user, staffMode]);

  const loadMessages = useCallback(async (caseId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase.from("support_messages").select("id,case_id,sender_id,body,is_staff_reply,created_at").eq("case_id", caseId).order("created_at", { ascending: true });
    if (error) { toast.error("Could not load case messages"); setMessages([]); }
    else setMessages((data ?? []) as SupportMessage[]);
    setLoadingMessages(false);
  }, []);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    setStatus(selected.status); setPriority(selected.priority);
    void loadMessages(selected.id);
  }, [selected, loadMessages]);

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) return;
    setSending(true);
    const { data, error } = await supabase.rpc("create_support_case", { p_subject: subject.trim(), p_category: category, p_message: initialMessage.trim() });
    if (error) toast.error(error.message || "Could not create support case");
    else {
      setSubject(""); setInitialMessage(""); setShowNew(false);
      await loadCases(); setSelectedId(data as string); toast.success("Support case created");
    }
    setSending(false);
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("reply_support_case", { p_case_id: selected.id, p_message: reply.trim() });
    if (error) toast.error(error.message || "Could not send reply");
    else { setReply(""); await Promise.all([loadCases(), loadMessages(selected.id)]); toast.success("Reply sent"); }
    setSending(false);
  };

  const saveCase = async () => {
    if (!selected || !staffMode) return;
    setSending(true);
    const { error } = await supabase.rpc("update_support_case", { p_case_id: selected.id, p_status: status, p_priority: priority });
    if (error) toast.error(error.message || "Could not update case");
    else { await loadCases(); toast.success("Case updated"); }
    setSending(false);
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">{staffMode ? <ShieldCheck className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{staffMode ? "Customer service" : "Riverbanc support"}</div><h1 className="font-display text-3xl font-semibold text-foreground">{staffMode ? "Support desk" : "Get help"}</h1><p className="mt-1 text-sm text-muted-foreground">{staffMode ? "Review customer cases, respond securely, and update case status." : "Open a case and follow replies from the Riverbanc team."}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void loadCases()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>{!staffMode && <Button onClick={() => setShowNew((value) => !value)}><Plus className="mr-2 h-4 w-4" />New case</Button>}</div>
    </div>
    {showNew && !staffMode && <Card><CardHeader><CardTitle>Open a support case</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createCase}>
      <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><label htmlFor="case-subject" className="text-sm font-medium">Subject</label><Input id="case-subject" value={subject} onChange={(e) => setSubject(e.target.value)} minLength={5} maxLength={160} required /></div><div className="space-y-2"><label htmlFor="case-category" className="text-sm font-medium">Category</label><select id="case-category" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div></div>
      <div className="space-y-2"><label htmlFor="case-initial-message" className="text-sm font-medium">How can we help?</label><Textarea id="case-initial-message" value={initialMessage} onChange={(e) => setInitialMessage(e.target.value)} rows={4} maxLength={10000} required placeholder="Describe the issue. Do not include passwords or one-time codes." /></div>
      <div className="flex gap-2"><Button type="submit" disabled={sending}><Send className="mr-2 h-4 w-4" />{sending ? "Submitting…" : "Submit case"}</Button><Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button></div>
    </form></CardContent></Card>}
    <div className="grid min-h-[28rem] gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
      <Card className="min-w-0"><CardHeader><CardTitle className="text-base">{staffMode ? "Customer cases" : "Your cases"} <span className="ml-1 text-sm font-normal text-muted-foreground">({cases.length})</span></CardTitle></CardHeader><CardContent className="space-y-2">
        {loading ? <p className="py-6 text-sm text-muted-foreground">Loading cases…</p> : cases.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{staffMode ? "No customer cases submitted." : "No support cases yet. Open one if you need help."}</p> : cases.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === item.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}><div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{item.case_number}</span><Badge variant="outline">{statusLabels[item.status]}</Badge></div><p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{item.subject}</p><p className="mt-1 text-xs text-muted-foreground">{categoryOptions.find((x) => x.value === item.category)?.label ?? item.category}</p>{staffMode && <p className="mt-1 text-xs text-muted-foreground">Priority: {item.priority}</p>}<p className="mt-2 text-xs text-muted-foreground">{dateLabel(item.last_message_at)}</p></button>)}
      </CardContent></Card>
      <Card className="min-w-0">{selected ? <><CardHeader className="border-b border-border/70"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{selected.case_number}</p><CardTitle className="mt-1 break-words text-lg">{selected.subject}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Opened {dateLabel(selected.created_at)} · {categoryOptions.find((x) => x.value === selected.category)?.label ?? selected.category}</p></div><Badge variant="outline">{statusLabels[selected.status]}</Badge></div>
        {staffMode && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="space-y-1 text-xs text-muted-foreground">Status<select value={status} onChange={(e) => setStatus(e.target.value as Status)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="space-y-1 text-xs text-muted-foreground">Priority<select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground">{(["normal","high","urgent"] as Priority[]).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="flex items-end"><Button variant="outline" onClick={() => void saveCase()} disabled={sending}>Save</Button></div></div>}
      </CardHeader><CardContent className="space-y-4 p-4"><div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">{loadingMessages ? <p className="py-6 text-sm text-muted-foreground">Loading messages…</p> : messages.map((message) => <div key={message.id} className={`flex ${message.is_staff_reply ? "justify-start" : "justify-end"}`}><div className={`max-w-[90%] rounded-xl border p-3 sm:max-w-[82%] ${message.is_staff_reply ? "border-primary/20 bg-primary/5" : "border-border bg-muted/40"}`}><div className="mb-2 flex items-center justify-between gap-4"><span className="text-xs font-semibold text-foreground">{message.is_staff_reply ? "Riverbanc Support" : staffMode ? "Customer" : "You"}</span><span className="text-[11px] text-muted-foreground">{dateLabel(message.created_at)}</span></div><p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.body}</p></div></div>)}</div>
        {selected.status === "closed" ? <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">This case is closed. Contact Riverbanc support if it needs to be reopened.</p> : <form onSubmit={sendReply} className="space-y-2 border-t border-border/70 pt-4"><label htmlFor="case-reply" className="text-sm font-medium">Reply</label><Textarea id="case-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={10000} required placeholder="Never include passwords or one-time codes." /><div className="flex justify-end"><Button type="submit" disabled={sending || !reply.trim()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending…" : "Send reply"}</Button></div></form>}
      </CardContent></> : <CardContent className="flex min-h-64 flex-col items-center justify-center text-center"><MessageCircle className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium text-foreground">Select a case</p><p className="mt-1 text-sm text-muted-foreground">{staffMode ? "Choose a customer case to review." : "Your conversation will appear here."}</p></CardContent>}</Card>
    </div>
    <p className="text-xs text-muted-foreground">Cases and messages are private to the customer and authorised support staff. Do not send passwords, one-time codes, or full identity documents.</p>
  </div>;
};
export default SupportPage;
