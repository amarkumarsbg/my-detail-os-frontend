"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarFront, CheckCircle2, ClipboardCheck, Download, Eye, History, Loader2, Mail, MessageSquare, MoreVertical, Pencil, Phone, Plus, RefreshCw, RotateCw, Search, Send, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { useAuthStore } from "@/store/auth-store";
import { useSettingsStore } from "@/store/settings-store";
import { useBranchScope } from "@/lib/branch-scope";
import { userCanCreate, userCanDelete, userCanEdit, userCanView } from "@/lib/rbac";
import { inspectionApi, inspectionApiError } from "@/lib/inspection-api";
import { inspectionRating } from "@/lib/inspection";
import { downloadInspectionPdf, downloadInspectionPdfFromUrl } from "@/lib/inspection-pdf";
import { toast } from "sonner";
import type { InspectionReport, InspectionSendLog } from "@/types/inspection";
import { RatingBadge } from "./inspection-checklist";

export function InspectionList() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const tenantPath = useTenantPath();
  const { selectedBranchId } = useBranchScope();
  const settings = useSettingsStore();
  const canView = userCanView(user, "JOB_CARDS");
  const [tab, setTab] = useState("reports");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pagination, setPagination] = useState({ branchId: selectedBranchId, page: 1 });
  const page = pagination.branchId === selectedBranchId ? pagination.page : 1;
  const setPage = (next: number | ((current: number) => number)) => setPagination({ branchId: selectedBranchId, page: typeof next === "function" ? next(page) : next });
  const [refresh, setRefresh] = useState(0);
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [history, setHistory] = useState<InspectionSendLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendReport, setSendReport] = useState<InspectionReport | null>(null);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [deleteReport, setDeleteReport] = useState<InspectionReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [revisionReport, setRevisionReport] = useState<InspectionReport | null>(null);
  const [creatingRevision, setCreatingRevision] = useState(false);
  const [resendingId, setResendingId] = useState("");
  const [resendEntry, setResendEntry] = useState<InspectionSendLog | null>(null);
  const [resendRecipient, setResendRecipient] = useState("");

  useEffect(() => {
    if (!canView) return;
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const params = new URLSearchParams({ page: String(page), limit: "20", q: search });
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      if (status !== "ALL") params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      try {
        if (tab === "reports") {
          const result = await inspectionApi.list(params);
          if (active) { setReports(result.items); setTotal(result.total); setTotalPages(result.totalPages); }
        } else {
          const result = await inspectionApi.history(params);
          if (active) { setHistory(result.items); setTotal(result.total); setTotalPages(result.totalPages); }
        }
      } catch (failure) {
        if (active) setError(inspectionApiError(failure));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [canView, tab, search, status, from, to, page, selectedBranchId, refresh]);

  if (!canView) return <p className="p-6 text-muted-foreground">You do not have permission to view inspections.</p>;
  const changeTab = (value: string) => { setTab(value); setStatus("ALL"); setPage(1); };
  const canEditReports = userCanEdit(user, "JOB_CARDS");
  const canDeleteReports = userCanDelete(user, "JOB_CARDS");
  const downloadPdf = async (report: InspectionReport) => {
    try {
      await downloadInspectionPdf(report, { name: settings.businessName, address: settings.businessAddress, phone: settings.businessPhone, color: settings.brandPrimary });
    } catch (failure) { toast.error(inspectionApiError(failure)); }
  };
  const sendWhatsApp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sendReport) return;
    setSending(true);
    try {
      const latest = await inspectionApi.get(sendReport.id);
      if (latest.item.status !== "FINAL" || !Number.isInteger(latest.item.revision) || latest.item.revision < 1) {
        throw new Error("The finalized report revision could not be verified. Refresh the report and try again.");
      }
      const result = await inspectionApi.send(latest.item, "WHATSAPP", sendRecipient.trim(), crypto.randomUUID());
      if (result.item.status === "FAILED") toast.error(result.item.error || "Sending failed");
      else {
        toast.success(result.item.status === "QUEUED" ? "Report queued for WhatsApp" : "Report sent on WhatsApp");
        setSendReport(null);
        setRefresh((value) => value + 1);
      }
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setSending(false); }
  };
  const confirmDelete = async () => {
    if (!deleteReport) return;
    setDeleting(true);
    try {
      await inspectionApi.delete(deleteReport.id);
      toast.success("Inspection report deleted");
      setDeleteReport(null);
      setRefresh((value) => value + 1);
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setDeleting(false); }
  };
  const editChecklist = (report: InspectionReport) => {
    if (report.status === "DRAFT") {
      router.push(tenantPath(`/inspections/${report.id}`));
      return;
    }
    setRevisionReport(report);
  };
  const confirmRevision = async () => {
    if (!revisionReport) return;
    setCreatingRevision(true);
    try {
      const result = await inspectionApi.revise(revisionReport);
      setRevisionReport(null);
      toast.success(`Revision ${result.item.revision} created`);
      router.push(tenantPath(`/inspections/${result.item.id}`));
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setCreatingRevision(false); }
  };
  const resend = (entry: InspectionSendLog) => {
    setResendEntry(entry);
    setResendRecipient(entry.recipient);
  };
  const confirmResend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resendEntry) return;
    setResendingId(resendEntry.id);
    try {
      const result = await inspectionApi.resend({ ...resendEntry, recipient: resendRecipient.trim() }, crypto.randomUUID());
      if (result.item.status === "FAILED") toast.error(result.item.error || "Resend failed");
      else {
        toast.success(result.item.status === "QUEUED" ? "Report queued for resend" : "Report resent");
        setResendEntry(null);
        setRefresh((value) => value + 1);
      }
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setResendingId(""); }
  };
  const downloadHistoryPdf = async (entry: InspectionSendLog) => {
    try {
      const result = await inspectionApi.get(entry.inspectionId);
      const sameRevision = !Number.isInteger(entry.reportRevision) || result.item.revision === entry.reportRevision;
      if (result.item.status === "FINAL" && sameRevision) {
        await downloadInspectionPdf(result.item, { name: settings.businessName, address: settings.businessAddress, phone: settings.businessPhone, color: settings.brandPrimary });
        return;
      }
      await downloadInspectionPdfFromUrl(entry.pdfUrl, entry.reportNumber, entry.reportRevision);
    } catch (failure) { toast.error(inspectionApiError(failure)); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Vehicle Inspections" actions={userCanCreate(user, "JOB_CARDS") ? <Button asChild><Link href={tenantPath("/inspections/new")}><Plus className="mr-2 h-4 w-4" />Create Inspection</Link></Button> : null} />
      <Dialog open={Boolean(resendEntry)} onOpenChange={(open) => { if (!open && !resendingId) setResendEntry(null); }}>
        <DialogContent mobileVariant="centered" className="sm:max-w-2xl">
          <form className="space-y-5" onSubmit={(event) => void confirmResend(event)}>
            <DialogHeader className="flex-row items-start gap-4 space-y-0 pr-8">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageSquare className="size-6" /></div>
              <div className="space-y-1">
                <DialogTitle>Resend Inspection Report</DialogTitle>
                <DialogDescription>Send the inspection PDF directly to the customer on {resendEntry?.channel === "EMAIL" ? "email" : "WhatsApp"}.</DialogDescription>
              </div>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <p className="font-semibold">Report ID: {resendEntry?.reportNumber}</p>
                <Badge className="gap-1 border-green-200 bg-green-50 text-green-700"><CheckCircle2 className="size-3.5" />Previously Sent</Badge>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3 pt-3 text-sm">
                <span className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" />{resendEntry?.customerName}</span>
                <span className="flex items-center gap-2"><CarFront className="size-4 text-muted-foreground" />{resendEntry?.vehicleRegistration}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inspection-resend-recipient">Customer {resendEntry?.channel === "EMAIL" ? "Email Address" : "WhatsApp Number"} *</Label>
              <div className="relative">
                {resendEntry?.channel === "EMAIL" ? <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" /> : <Phone className="absolute left-3 top-3 size-4 text-muted-foreground" />}
                <Input id="inspection-resend-recipient" type={resendEntry?.channel === "EMAIL" ? "email" : "tel"} required value={resendRecipient} onChange={(event) => setResendRecipient(event.target.value)} className="pl-10" />
              </div>
              <p className="text-sm text-muted-foreground">The customer will receive the inspection PDF and vehicle diagnostic summary.</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={Boolean(resendingId) || !resendRecipient.trim()}><Send className="mr-2 size-4" />{resendingId ? "Resending..." : "Resend Report"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="reports"><ClipboardCheck className="mr-2 h-4 w-4" />All Inspections</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-2 h-4 w-4" />Send History</TabsTrigger>
        </TabsList>
      </Tabs>
      <form className="flex flex-wrap items-end gap-3 border-b pb-5" onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); setPage(1); }}>
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search inspections" placeholder="Report, customer, phone or registration" className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent>{["ALL", ...(tab === "reports" ? ["DRAFT", "FINAL"] : ["QUEUED", "SENT", "DELIVERED", "FAILED"])].map((value) => <SelectItem key={value} value={value}>{value === "ALL" ? "All statuses" : value.charAt(0) + value.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
        </Select>
        <label className="space-y-1 text-xs text-muted-foreground">From<Input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="w-36" /></label>
        <label className="space-y-1 text-xs text-muted-foreground">To<Input type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="w-36" /></label>
        <Button type="submit" variant="outline"><Search className="mr-2 h-4 w-4" />Search</Button>
        <Button type="button" variant="outline" size="icon" title="Refresh inspections" aria-label="Refresh inspections" onClick={() => setRefresh((value) => value + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </form>
      {loading ? <div className="flex justify-center py-20" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="sr-only">Loading inspections</span></div> : error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5"><p className="text-sm">{error}</p><Button variant="outline" onClick={() => setRefresh((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>
      ) : !total ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center"><ClipboardCheck className="h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">{tab === "reports" ? "No inspections found" : "No send history found"}</h2></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">{tab === "reports" ? <tr><th className="p-4">Report ID</th><th className="p-4">Customer</th><th className="p-4">Vehicle</th><th className="p-4">Date</th><th className="p-4">Overall Rating</th><th className="p-4">Inspected By</th><th className="p-4">WhatsApp Status</th><th className="p-4 text-right">Actions</th></tr> : <tr><th className="p-4">Report ID</th><th className="p-4">Customer</th><th className="p-4">Vehicle</th><th className="p-4">Channel</th><th className="p-4">Sent At</th><th className="p-4">Sent By</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr>}</thead>
              <tbody>
                {tab === "reports" ? reports.map((report) => <tr key={report.id} className="border-t hover:bg-muted/30"><td className="p-4"><Link className="font-medium text-primary hover:underline" href={tenantPath(`/inspections/${report.id}`)}>{report.reportNumber}</Link><p className="text-xs text-muted-foreground">Revision {report.revision} · {report.status === "FINAL" ? "Final" : "Draft"}</p></td><td className="p-4"><p>{report.customerName}</p><p className="text-xs text-muted-foreground">{report.customerPhone}</p></td><td className="p-4"><p className="font-medium">{report.vehicleRegistration}</p><p className="text-xs text-muted-foreground">{report.vehicleMakeModel}</p></td><td className="whitespace-nowrap p-4">{report.inspectedAt}</td><td className="p-4"><RatingBadge rating={report.overallOverride ?? inspectionRating(report.sections)} /></td><td className="p-4"><p className="font-medium">{report.inspectorName}</p><p className="text-xs text-muted-foreground">{report.inspectorRole || "Inspector"}</p></td><td className="p-4"><Badge variant={report.whatsAppStatus === "FAILED" ? "destructive" : report.whatsAppStatus === "DELIVERED" ? "default" : "secondary"}>{(report.whatsAppStatus ?? "NOT_SENT").replace("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}</Badge></td><td className="p-2 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${report.reportNumber}`} title="Report actions"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem asChild><Link href={tenantPath(`/inspections/${report.id}`)}><Eye className="h-4 w-4" />View Report</Link></DropdownMenuItem>{canEditReports && <DropdownMenuItem onSelect={() => editChecklist(report)}><Pencil className="h-4 w-4" />Edit Checklist</DropdownMenuItem>}<DropdownMenuItem onSelect={() => void downloadPdf(report)}><Download className="h-4 w-4" />Download PDF</DropdownMenuItem>{canEditReports && <DropdownMenuItem disabled={report.status !== "FINAL"} title={report.status !== "FINAL" ? "Finalize the report before sending" : undefined} onSelect={() => { setSendRecipient(report.customerPhone); setSendReport(report); }}><Send className="h-4 w-4 text-primary" />Send on WhatsApp</DropdownMenuItem>}{canDeleteReports && <DropdownMenuItem className="border-t border-border mt-1 pt-2 text-destructive focus:text-destructive" onSelect={() => setDeleteReport(report)}><Trash2 className="h-4 w-4" />Delete Report</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></td></tr>) : history.map((log) => <tr key={log.id} className="border-t hover:bg-muted/30"><td className="p-4"><Link className="font-medium text-primary hover:underline" href={tenantPath(`/inspections/${log.inspectionId}`)}>{log.reportNumber}</Link><p className="text-xs text-muted-foreground">Revision {log.reportRevision} · {new Date(log.sentAt).toLocaleString()}</p></td><td className="p-4"><p>{log.customerName}</p><p className="text-xs text-muted-foreground">{log.recipient}</p></td><td className="p-4"><p className="font-medium">{log.vehicleRegistration}</p></td><td className="p-4"><Badge variant="outline" className="border-green-600/30 bg-green-500/10 text-green-700 dark:text-green-400">{log.channel === "WHATSAPP" ? "WhatsApp" : "Email"}</Badge></td><td className="whitespace-nowrap p-4">{new Date(log.sentAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}<p className="text-xs text-muted-foreground">{new Date(log.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></td><td className="p-4 font-medium">{log.sentBy}</td><td className="p-4"><Badge variant={log.status === "FAILED" ? "destructive" : log.status === "DELIVERED" || log.status === "SENT" ? "default" : "secondary"}>{log.status === "DELIVERED" ? "Delivered" : log.status === "SENT" ? "Sent" : log.status === "FAILED" ? "Failed" : "Queued"}</Badge>{log.error && <p className="mt-1 text-xs text-destructive">{log.error}</p>}</td><td className="p-2"><div className="flex items-center justify-end gap-1">{canEditReports && <Button variant="outline" size="sm" disabled={Boolean(resendingId)} onClick={() => void resend(log)}><RotateCw className={`mr-1 h-4 w-4 ${resendingId === log.id ? "animate-spin" : ""}`} />Resend</Button>}<Button variant="ghost" size="icon" title="Download PDF" aria-label={`Download PDF for ${log.reportNumber}`} disabled={Boolean(resendingId)} onClick={() => void downloadHistoryPdf(log)}><Download className="h-4 w-4" /></Button><Button asChild variant="ghost" size="icon" title="View Report" aria-label={`View report ${log.reportNumber}`}><Link href={tenantPath(`/inspections/${log.inspectionId}`)}><Eye className="h-4 w-4" /></Link></Button></div></td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{total} results · Page {page} of {Math.max(1, totalPages)}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
        </>
      )}
      <Dialog open={Boolean(sendReport)} onOpenChange={(open) => { if (!open && !sending) setSendReport(null); }}><DialogContent><form onSubmit={(event) => void sendWhatsApp(event)}><DialogHeader><DialogTitle>Send report on WhatsApp</DialogTitle><DialogDescription>{sendReport?.reportNumber} · Revision {sendReport?.revision}</DialogDescription></DialogHeader><div className="space-y-2 py-5"><Label htmlFor="inspection-list-whatsapp-recipient">WhatsApp number</Label><Input id="inspection-list-whatsapp-recipient" type="tel" required value={sendRecipient} onChange={(event) => setSendRecipient(event.target.value)} /></div><DialogFooter><Button type="button" variant="outline" disabled={sending} onClick={() => setSendReport(null)}>Cancel</Button><Button type="submit" disabled={sending || !sendRecipient.trim()}><Send className="mr-2 h-4 w-4" />{sending ? "Sending..." : "Send report"}</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={Boolean(deleteReport)} onOpenChange={(open) => { if (!open && !deleting) setDeleteReport(null); }}><DialogContent><DialogHeader><DialogTitle>Delete inspection report?</DialogTitle><DialogDescription>{deleteReport?.reportNumber} will be removed from the inspection list. Sent-report audit history must remain available.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={deleting} onClick={() => setDeleteReport(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}><Trash2 className="mr-2 h-4 w-4" />{deleting ? "Deleting..." : "Confirm Delete"}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(revisionReport)} onOpenChange={(open) => { if (!open && !creatingRevision) setRevisionReport(null); }}><DialogContent><DialogHeader><DialogTitle>Create a revision to edit?</DialogTitle><DialogDescription>{revisionReport?.reportNumber} revision {revisionReport?.revision} will remain unchanged. A new draft revision will be created for your checklist edits.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={creatingRevision} onClick={() => setRevisionReport(null)}>Cancel</Button><Button disabled={creatingRevision} onClick={() => void confirmRevision()}><Pencil className="mr-2 h-4 w-4" />{creatingRevision ? "Creating..." : "Create Revision"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}