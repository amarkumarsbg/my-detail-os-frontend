"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, Download, FilePlus2, Loader2, Plus, RefreshCw, Save, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearchSelect } from "@/components/shared/customer-search-select";
import { AddVehicleDialog } from "@/components/vehicles/add-vehicle-dialog";
import { useTenantPath } from "@/components/tenant/tenant-context";
import { MultiPhotoCameraCapture, canUseLiveCameraPreview, requestCameraStream } from "@/components/job-cards/multi-photo-camera-capture";
import { useAuthStore } from "@/store/auth-store";
import { useCustomerStore } from "@/store/customer-store";
import { fetchCustomerVehicles, useVehicleStore } from "@/store/vehicle-store";
import { useBranchStore } from "@/store/branch-store";
import { useSettingsStore } from "@/store/settings-store";
import { useBranchScope } from "@/lib/branch-scope";
import { useScopedJobCards } from "@/hooks/use-scoped-data";
import { userCanCreate, userCanEdit, userCanView } from "@/lib/rbac";
import { createInspectionSections, DEFAULT_INSPECTION_TERMS, inspectionProgress, inspectionRating, resetInspectionSections, validateInspection } from "@/lib/inspection";
import { inspectionApi, inspectionApiError } from "@/lib/inspection-api";
import { downloadInspectionPdf } from "@/lib/inspection-pdf";
import type { InspectionPhoto, InspectionPreDriveCondition, InspectionReport, InspectionTemplate, VehicleConditionPin } from "@/types/inspection";
import type { Vehicle } from "@/types";
import { AuthenticatedInspectionImage } from "./authenticated-inspection-image";
import { InspectionChecklist, RatingBadge } from "./inspection-checklist";
import { VehicleConditionSection } from "./vehicle-condition-section";

type Confirmation = { title: string; description: string; action: () => void | Promise<void> };

function withVehicleConditionDefaults(report: InspectionReport): InspectionReport {
  return {
    ...report,
    overallPreDriveCondition: report.overallPreDriveCondition ?? null,
    vehicleConditions: report.vehicleConditions ?? [],
  };
}

export function InspectionEditor({ id }: { id?: string }) {
  const router = useRouter();
  const tenantPath = useTenantPath();
  const user = useAuthStore((state) => state.user);
  const customers = useCustomerStore((state) => state.customers);
  const vehicles = useVehicleStore((state) => state.vehicles);
  const branches = useBranchStore((state) => state.branches);
  const settings = useSettingsStore();
  const { selectedBranchId } = useBranchScope();
  const jobs = useScopedJobCards();
  const [report, setReport] = useState<InspectionReport>(() => ({
    id: "", reportNumber: "", revision: 0, status: "DRAFT", branchId: selectedBranchId ?? user?.branchId ?? "",
    customerId: "", customerName: "", customerPhone: "", customerEmail: "", vehicleId: "", vehicleRegistration: "", vehicleMakeModel: "",
    inspectedAt: new Date().toLocaleDateString("en-CA"), inspectorName: user?.name ?? "", sections: createInspectionSections(), photos: [],
    notes: "", terms: DEFAULT_INSPECTION_TERMS, overrideReason: "", overallPreDriveCondition: null, vehicleConditions: [], createdAt: "", updatedAt: "",
  }));
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [templateId, setTemplateId] = useState("default");
  const [templateDialog, setTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [sendDialog, setSendDialog] = useState(false);
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [recipient, setRecipient] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<Promise<MediaStream> | null>(null);
  const [viewPhoto, setViewPhoto] = useState<InspectionPhoto | null>(null);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleRefresh, setVehicleRefresh] = useState(0);
  const [vehicleLookup, setVehicleLookup] = useState<{ customerId: string; items: Vehicle[]; loading: boolean; error: string }>({ customerId: "", items: [], loading: false, error: "" });
  const uploadRef = useRef<HTMLInputElement>(null);
  const sendRequestId = useRef("");
  const canView = userCanView(user, "JOB_CARDS");
  const canModify = report.id ? userCanEdit(user, "JOB_CARDS") : userCanCreate(user, "JOB_CARDS");
  const editable = canModify && report.status === "DRAFT" && !busy;
  const progress = inspectionProgress(report.sections);
  const lookupMatches = vehicleLookup.customerId === report.customerId;
  const vehiclesLoading = Boolean(report.customerId) && (!lookupMatches || vehicleLookup.loading);
  const vehicleError = lookupMatches ? vehicleLookup.error : "";
  const customerVehicles = (lookupMatches && !vehicleLookup.loading && !vehicleLookup.error ? vehicleLookup.items : vehicles).filter((vehicle) => vehicle.customerId === report.customerId);

  useEffect(() => {
    if (!report.customerId || !canView) return;
    const customerId = report.customerId;
    let active = true;
    async function loadVehicles() {
      setVehicleLookup({ customerId, items: [], loading: true, error: "" });
      try {
        const items = await fetchCustomerVehicles(customerId);
        if (active) setVehicleLookup({ customerId, items, loading: false, error: "" });
      } catch (failure) {
        if (active) setVehicleLookup({ customerId, items: [], loading: false, error: failure instanceof Error ? failure.message : "Unable to load customer vehicles." });
      }
    }
    void loadVehicles();
    return () => { active = false; };
  }, [report.customerId, canView, vehicleRefresh]);

  useEffect(() => {
    if (!id || !canView) return;
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const result = await inspectionApi.get(id!);
        if (active) { setReport(withVehicleConditionDefaults(result.item)); setDirty(false); }
      } catch (failure) { if (active) setError(inspectionApiError(failure)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [id, canView, refresh]);

  useEffect(() => {
    if (!canView) return;
    let active = true;
    void inspectionApi.templates().then((result) => { if (active) setTemplates(result.items); }).catch(() => {});
    return () => { active = false; };
  }, [canView]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = (changes: Partial<InspectionReport>) => { setReport((current) => ({ ...current, ...changes })); setDirty(true); };
  const exit = () => {
    const action = () => router.push(tenantPath("/inspections"));
    if (dirty) setConfirmation({ title: "Discard unsaved changes?", description: "Changes since your last save will be lost.", action });
    else action();
  };
  const save = async (final: boolean) => {
    const issue = validateInspection(report, final);
    if (issue) { toast.error(issue); return; }
    setBusy(final ? "finalize" : "save"); setError("");
    try {
      const saved = await inspectionApi.save(report);
      const savedReport = withVehicleConditionDefaults({
        ...report,
        ...saved.item,
        overallPreDriveCondition: saved.item.overallPreDriveCondition ?? report.overallPreDriveCondition ?? null,
        vehicleConditions: saved.item.vehicleConditions ?? report.vehicleConditions ?? [],
      });
      setReport(savedReport); setDirty(false);
      if (final) {
        const finalized = await inspectionApi.finalize(savedReport);
        let finalReport = withVehicleConditionDefaults({
          ...savedReport,
          ...finalized.item,
          overallPreDriveCondition: finalized.item.overallPreDriveCondition ?? savedReport.overallPreDriveCondition ?? null,
          vehicleConditions: finalized.item.vehicleConditions ?? savedReport.vehicleConditions ?? [],
        });
        if (finalReport.status !== "FINAL") {
          finalReport = withVehicleConditionDefaults({
            ...savedReport,
            ...(await inspectionApi.get(savedReport.id)).item,
          });
        }
        if (finalReport.status !== "FINAL") {
          throw new Error("The inspection API saved the report but still reports it as a draft. Finalization was not confirmed.");
        }
        setReport(finalReport);
      }
      router.replace(tenantPath(`/inspections/${saved.item.id}`));
      toast.success(final ? "Inspection finalized" : "Draft saved");
    } catch (failure) { const message = inspectionApiError(failure); setError(message); toast.error(message); }
    finally { setBusy(""); }
  };

  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    patch({ customerId, customerName: customer?.name ?? "", customerPhone: customer?.phone ?? "", customerEmail: customer?.email ?? "", vehicleId: "", vehicleRegistration: "", vehicleMakeModel: "", vehicleYear: undefined, fuelType: undefined, insuranceDueDate: undefined, odometer: undefined, jobCardId: undefined });
  };
  const applyVehicle = (vehicle: Vehicle) => {
    if (vehicle.customerId !== report.customerId) return;
    patch({ vehicleId: vehicle.id, vehicleRegistration: vehicle.registrationNumber, vehicleMakeModel: `${vehicle.make} ${vehicle.model}`, vehicleYear: vehicle.year, fuelType: vehicle.fuelType, insuranceDueDate: vehicle.insuranceDueDate, odometer: vehicle.odometer, jobCardId: undefined });
  };
  const selectVehicle = (vehicleId: string) => {
    const vehicle = customerVehicles.find((item) => item.id === vehicleId);
    if (vehicle) applyVehicle(vehicle);
  };
  const removeCheckpoint = (sectionId: string, checkpointId?: string) => setConfirmation({
    title: checkpointId ? "Remove checkpoint?" : "Remove inspection section?", description: "Its readings, remarks and ratings will be removed from this draft.",
    action: () => {
      const sections = checkpointId ? report.sections.map((section) => section.id === sectionId ? { ...section, checkpoints: section.checkpoints.filter((checkpoint) => checkpoint.id !== checkpointId) } : section) : report.sections.filter((section) => section.id !== sectionId);
      const remaining = new Set(sections.flatMap((section) => section.checkpoints.map((checkpoint) => checkpoint.id)));
      patch({ sections, photos: report.photos.map((photo) => photo.checkpointId && !remaining.has(photo.checkpointId) ? { ...photo, checkpointId: undefined } : photo) });
    },
  });
  const clearVehicleConditions = () => setConfirmation({
    title: "Clear all vehicle conditions?",
    description: "All condition pins will be removed from this inspection draft.",
    action: () => patch({ vehicleConditions: [] }),
  });
  const uploadPhotos = async (files: File[]) => {
    if (!report.branchId) { toast.error("Select a branch before uploading photos."); return; }
    if (report.photos.length + files.length > 24) { toast.error("A report can contain up to 24 photos."); return; }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)) { toast.error("Choose JPEG, PNG or WebP photos, up to 10 MB each."); return; }
    setBusy("upload");
    try {
      for (const file of files) {
        const photo = await inspectionApi.upload(report.branchId, file);
        setReport((current) => ({ ...current, photos: [...current.photos, { ...photo, caption: file.name }] }));
        setDirty(true);
      }
      toast.success("Photos uploaded");
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setBusy(""); }
  };
  const pdf = async () => {
    setBusy("pdf");
    try {
      await downloadInspectionPdf(report, { name: settings.businessName, address: settings.businessAddress, phone: settings.businessPhone, color: settings.brandPrimary });
    } catch (failure) { toast.error(inspectionApiError(failure)); }
    finally { setBusy(""); }
  };

  if (!canView || (!id && !canModify)) return <p className="p-6 text-muted-foreground">You do not have permission to access this inspection.</p>;
  if (loading) return <div className="flex justify-center py-20" role="status"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Loading inspection</span></div>;
  if (id && !report.id && error) return <div className="space-y-4"><Button variant="outline" onClick={exit}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><p role="alert" className="text-destructive">{error}</p><Button onClick={() => setRefresh((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Back to inspections" aria-label="Back to inspections" onClick={exit}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{report.reportNumber || "New Inspection Report"}</h1>
            <p className="text-sm text-muted-foreground">Vehicle condition reports and diagnostic checklists</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {report.id && <Button variant="outline" disabled={Boolean(busy) || dirty} onClick={() => void pdf()}><Download className="mr-2 h-4 w-4" />PDF</Button>}
          {report.status === "FINAL" && userCanEdit(user, "JOB_CARDS") && <Button variant="outline" disabled={Boolean(busy)} onClick={() => setConfirmation({ title: "Create a new revision?", description: "Previously sent PDF versions will remain unchanged.", action: async () => { setBusy("revise"); try { const result = await inspectionApi.revise(report); setReport(result.item); setDirty(false); router.replace(tenantPath(`/inspections/${result.item.id}`)); toast.success("Draft revision created"); } catch (failure) { toast.error(inspectionApiError(failure)); } finally { setBusy(""); } } })}><FilePlus2 className="mr-2 h-4 w-4" />New Revision</Button>}
          {report.status === "FINAL" && canModify && <Button disabled={Boolean(busy)} onClick={() => { sendRequestId.current = crypto.randomUUID(); setChannel("WHATSAPP"); setRecipient(report.customerPhone); setSendDialog(true); }}><Send className="mr-2 h-4 w-4" />Send Report</Button>}
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4"><RatingBadge rating={report.overallOverride ?? inspectionRating(report.sections)} /><span className="text-sm text-muted-foreground">{report.status === "FINAL" ? "Final report" : "Draft"} · Revision {report.revision || "pending"}</span><span className="ml-auto text-xs text-muted-foreground">{progress.checked} / {progress.total} checkpoints reviewed{dirty ? " · Unsaved changes" : ""}</span><Progress value={progress.percent} className="w-full" /></div>
      <fieldset disabled={!editable} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2"><Label>Branch</Label><Select value={report.branchId} onValueChange={(value) => patch({ branchId: value, jobCardId: undefined })} disabled={!editable || Boolean(selectedBranchId) || report.photos.length > 0}><SelectTrigger aria-label="Workshop branch"><SelectValue placeholder="Select branch" /></SelectTrigger><SelectContent>{branches.filter((branch) => branch.isActive && (!selectedBranchId || branch.id === selectedBranchId)).map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Customer</Label>{editable ? <CustomerSearchSelect customers={customers} selectedCustomerId={report.customerId} onSelectCustomer={selectCustomer} /> : <Input aria-label="Customer" value={report.customerName} readOnly />}</div>
        <div className="space-y-2"><Label>Vehicle</Label><div className="flex items-center gap-2"><Select value={report.vehicleId} onValueChange={selectVehicle} disabled={!editable || !report.customerId || vehiclesLoading}><SelectTrigger aria-label="Vehicle" className="min-w-0 flex-1"><SelectValue placeholder={report.vehicleRegistration || (vehiclesLoading ? "Loading vehicles..." : "Select vehicle")} /></SelectTrigger><SelectContent>{customerVehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.registrationNumber} · {vehicle.make} {vehicle.model}</SelectItem>)}</SelectContent></Select>{userCanCreate(user, "VEHICLES") && <Button type="button" variant="outline" size="icon" className="shrink-0" title="Add vehicle for selected customer" aria-label="Add vehicle for selected customer" disabled={!editable || !report.customerId || vehiclesLoading} onClick={() => setAddVehicleOpen(true)}><Plus className="h-4 w-4" /></Button>}</div>{vehiclesLoading && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading customer vehicles</p>}{vehicleError && <div className="flex items-center gap-2"><p role="alert" className="text-xs text-destructive">{vehicleError}</p><Button type="button" variant="ghost" size="icon" title="Reload customer vehicles" aria-label="Reload customer vehicles" onClick={() => setVehicleRefresh((value) => value + 1)}><RefreshCw className="h-4 w-4" /></Button></div>}{report.customerId && !vehiclesLoading && !vehicleError && !customerVehicles.length && <p className="text-xs text-muted-foreground">No vehicles linked to this customer.</p>}</div>
        <div className="space-y-2"><Label htmlFor="inspection-date">Inspection date</Label><Input id="inspection-date" type="date" value={report.inspectedAt} onChange={(event) => patch({ inspectedAt: event.target.value })} className="date-input-icon-end pr-9 [color-scheme:light] dark:[color-scheme:dark]" /></div>
        <div className="space-y-2"><Label htmlFor="inspection-inspector">Inspector</Label><Input id="inspection-inspector" value={report.inspectorName} onChange={(event) => patch({ inspectorName: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="inspection-odometer">Odometer (km)</Label><Input id="inspection-odometer" type="number" min="0" value={report.odometer ?? ""} onChange={(event) => patch({ odometer: event.target.value === "" ? undefined : Number(event.target.value) })} /></div>
        <div className="space-y-2"><Label>Job card (optional)</Label><Select value={report.jobCardId || "none"} disabled={!editable || !report.vehicleId} onValueChange={(value) => patch({ jobCardId: value === "none" ? undefined : value })}><SelectTrigger aria-label="Linked job card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Standalone inspection</SelectItem>{jobs.filter((job) => job.vehicleId === report.vehicleId && job.customerId === report.customerId && job.branchId === report.branchId).map((job) => <SelectItem key={job.id} value={job.id}>{job.jobNumber}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Overall rating</Label><Select value={report.overallOverride || "AUTO"} disabled={!editable} onValueChange={(value) => patch({ overallOverride: value === "AUTO" ? undefined : value as InspectionReport["overallOverride"], overrideReason: value === "AUTO" ? "" : report.overrideReason })}><SelectTrigger aria-label="Overall rating override"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTO">Calculated from checklist</SelectItem><SelectItem value="GOOD">Good</SelectItem><SelectItem value="AVERAGE">Average</SelectItem><SelectItem value="BAD">Bad</SelectItem></SelectContent></Select></div>
        {report.overallOverride && <div className="space-y-2"><Label htmlFor="inspection-override">Override reason</Label><Input id="inspection-override" value={report.overrideReason} onChange={(event) => patch({ overrideReason: event.target.value })} required /></div>}
      </fieldset>
      <VehicleConditionSection
        overallCondition={report.overallPreDriveCondition}
        conditions={report.vehicleConditions ?? []}
        editable={editable}
        onOverallConditionChange={(overallPreDriveCondition: InspectionPreDriveCondition) => patch({ overallPreDriveCondition })}
        onConditionsChange={(vehicleConditions: VehicleConditionPin[]) => patch({ vehicleConditions })}
        onClearAll={clearVehicleConditions}
      />
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Component Checklists</h2>{editable && <div className="flex flex-wrap gap-2"><Select value={templateId} onValueChange={setTemplateId}><SelectTrigger className="w-44" aria-label="Inspection template"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default template</SelectItem>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setConfirmation({ title: "Replace checklist with template?", description: "Current ratings, readings, remarks and photo checkpoint links will be cleared.", action: () => { const template = templates.find((item) => item.id === templateId); patch({ sections: template ? resetInspectionSections(template.sections) : createInspectionSections(), terms: template?.terms ?? DEFAULT_INSPECTION_TERMS, photos: report.photos.map((photo) => ({ ...photo, checkpointId: undefined })) }); } })}><RefreshCw className="mr-2 h-4 w-4" />Load Template</Button>{userCanEdit(user, "SETTINGS") && <Button variant="outline" onClick={() => setTemplateDialog(true)}><Save className="mr-2 h-4 w-4" />Save Template</Button>}</div>}</div>
        <InspectionChecklist sections={report.sections} editable={editable} onChange={(sections) => patch({ sections })} onRemove={removeCheckpoint} />
        {editable && <Button variant="outline" onClick={() => patch({ sections: [...report.sections, { id: crypto.randomUUID(), name: "New section", checkpoints: [] }] })}><Plus className="mr-2 h-4 w-4" />Add Section</Button>}
      </section>
      <section className="space-y-4 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Inspection Photos ({report.photos.length})</h2>{editable && <div className="flex gap-2"><Button variant="outline" onClick={() => { if (canUseLiveCameraPreview()) { const stream = requestCameraStream(); void stream.catch(() => {}); setCameraStream(stream); } setCameraOpen(true); }}><Camera className="mr-2 h-4 w-4" />Take Photo</Button><Button variant="outline" onClick={() => uploadRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button></div>}</div>
        <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void uploadPhotos(files); }} />
        {!report.photos.length && <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-sm text-muted-foreground"><Camera className="h-5 w-5" />No photos attached</div>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{report.photos.map((photo) => <div key={photo.id} className="space-y-2 rounded-lg border bg-card p-3"><button type="button" className="block aspect-video w-full overflow-hidden rounded-md bg-muted" onClick={() => setViewPhoto(photo)} aria-label={`View ${photo.caption || "inspection photo"}`}>
          <AuthenticatedInspectionImage src={photo.url} alt={photo.caption || "Inspection photo"} className="h-full w-full object-contain" />
        </button><Input aria-label="Photo caption" value={photo.caption} disabled={!editable} onChange={(event) => patch({ photos: report.photos.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item) })} /><div className="flex gap-2"><Select value={photo.checkpointId || "none"} disabled={!editable} onValueChange={(value) => patch({ photos: report.photos.map((item) => item.id === photo.id ? { ...item, checkpointId: value === "none" ? undefined : value } : item) })}><SelectTrigger aria-label="Photo checkpoint"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">General photo</SelectItem>{report.sections.flatMap((section) => section.checkpoints.map((checkpoint) => <SelectItem key={checkpoint.id} value={checkpoint.id}>{section.name} · {checkpoint.name}</SelectItem>))}</SelectContent></Select>{editable && <Button variant="ghost" size="icon" title="Remove photo" aria-label="Remove photo" onClick={() => setConfirmation({ title: "Remove photo?", description: "This photo will be detached from the draft.", action: () => patch({ photos: report.photos.filter((item) => item.id !== photo.id) }) })}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div>)}</div>
      </section>
      <fieldset disabled={!editable} className="grid gap-5 border-t pt-5 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="inspection-notes">Inspection notes</Label><Textarea id="inspection-notes" value={report.notes} onChange={(event) => patch({ notes: event.target.value })} rows={4} /></div><div className="space-y-2"><Label htmlFor="inspection-terms">Terms and conditions</Label><Textarea id="inspection-terms" value={report.terms} onChange={(event) => patch({ terms: event.target.value })} rows={4} /></div></fieldset>
      {canModify && report.status === "DRAFT" && <div className="flex flex-wrap justify-end gap-3 border-t bg-background py-4"><Button variant="outline" disabled={Boolean(busy)} onClick={() => void save(false)}>{busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button><Button disabled={Boolean(busy)} onClick={() => setConfirmation({ title: "Finalize inspection?", description: "The report will become read-only. Future edits require a new revision.", action: () => save(true) })}>{busy === "finalize" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Finalize Inspection</Button></div>}
      <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button><Button onClick={() => { const action = confirmation?.action; setConfirmation(null); void action?.(); }}>Confirm</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={sendDialog} onOpenChange={setSendDialog}><DialogContent><form onSubmit={async (event) => { event.preventDefault(); setBusy("send"); try { const result = await inspectionApi.send(report, channel, recipient.trim(), sendRequestId.current); if (result.item.status === "FAILED") { sendRequestId.current = crypto.randomUUID(); toast.error(result.item.error || "Sending failed"); } else { toast.success(result.item.status === "QUEUED" ? "Report queued for sending" : "Report sent"); setSendDialog(false); } } catch (failure) { toast.error(inspectionApiError(failure)); } finally { setBusy(""); } }}><DialogHeader><DialogTitle>Send Inspection Report</DialogTitle><DialogDescription>{report.reportNumber} · Revision {report.revision}</DialogDescription></DialogHeader><div className="space-y-4 py-5"><Select value={channel} disabled={Boolean(busy)} onValueChange={(value) => { sendRequestId.current = crypto.randomUUID(); const next = value as typeof channel; setChannel(next); setRecipient(next === "EMAIL" ? report.customerEmail : report.customerPhone); }}><SelectTrigger aria-label="Delivery channel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WHATSAPP">WhatsApp</SelectItem><SelectItem value="EMAIL">Email</SelectItem></SelectContent></Select><Label htmlFor="inspection-recipient">Recipient</Label><Input id="inspection-recipient" type={channel === "EMAIL" ? "email" : "tel"} disabled={Boolean(busy)} required value={recipient} onChange={(event) => { sendRequestId.current = crypto.randomUUID(); setRecipient(event.target.value); }} /></div><DialogFooter><Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setSendDialog(false)}>Cancel</Button><Button type="submit" disabled={Boolean(busy) || !recipient.trim()}>{busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send PDF</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}><DialogContent><form onSubmit={async (event) => { event.preventDefault(); setBusy("template"); try { const result = await inspectionApi.saveTemplate({ name: templateName.trim(), sections: resetInspectionSections(report.sections), terms: report.terms }); setTemplates((current) => [...current, result.item]); setTemplateId(result.item.id); setTemplateDialog(false); setTemplateName(""); toast.success("Template saved"); } catch (failure) { toast.error(inspectionApiError(failure)); } finally { setBusy(""); } }}><DialogHeader><DialogTitle>Save Workshop Template</DialogTitle><DialogDescription>Checkpoint ratings, readings and remarks are excluded.</DialogDescription></DialogHeader><div className="py-5"><Label htmlFor="inspection-template-name">Template name</Label><Input id="inspection-template-name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button><Button type="submit" disabled={Boolean(busy) || !templateName.trim()}><Save className="mr-2 h-4 w-4" />Save Template</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={Boolean(viewPhoto)} onOpenChange={(open) => { if (!open) setViewPhoto(null); }}><DialogContent><DialogHeader><DialogTitle>{viewPhoto?.caption || "Inspection photo"}</DialogTitle></DialogHeader>{viewPhoto && (
        <AuthenticatedInspectionImage src={viewPhoto.url} alt={viewPhoto.caption || "Inspection photo"} className="max-h-[70vh] w-full object-contain" />
      )}</DialogContent></Dialog>
      <MultiPhotoCameraCapture open={cameraOpen} onOpenChange={setCameraOpen} title="Inspection Photos" maxPhotos={24 - report.photos.length} streamPromise={cameraStream} onComplete={uploadPhotos} />
      <AddVehicleDialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen} lockedCustomerId={report.customerId || undefined} title={`Add Vehicle for ${report.customerName || "Customer"}`} onCreated={(vehicle) => {
        if (vehicle.customerId !== report.customerId) return;
        setVehicleLookup((current) => ({ customerId: report.customerId, items: [vehicle, ...(current.customerId === report.customerId ? current.items.filter((item) => item.id !== vehicle.id) : [])], loading: false, error: "" }));
        applyVehicle(vehicle);
      }} />
    </div>
  );
}