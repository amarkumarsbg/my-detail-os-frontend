"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inspectionRating, INSPECTION_RATING_LABELS } from "@/lib/inspection";
import type { InspectionRating, InspectionSection } from "@/types/inspection";

export function RatingBadge({ rating }: { rating: InspectionRating }) {
  return <Badge variant="outline" className={cn("whitespace-nowrap", rating === "GOOD" && "border-green-600/30 bg-green-500/10 text-green-700 dark:text-green-400", rating === "AVERAGE" && "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", rating === "BAD" && "border-destructive/30 bg-destructive/10 text-destructive", (rating === "NOT_CHECKED" || rating === "NA") && "border-muted-foreground/20 bg-muted text-muted-foreground")}>{INSPECTION_RATING_LABELS[rating]}</Badge>;
}

export function InspectionChecklist({ sections, editable, onChange, onRemove }: {
  sections: InspectionSection[];
  editable: boolean;
  onChange: (sections: InspectionSection[]) => void;
  onRemove: (sectionId: string, checkpointId?: string) => void;
}) {
  const update = (section: InspectionSection) => onChange(sections.map((item) => item.id === section.id ? section : item));
  return <div className="space-y-4">{sections.map((section) => (
    <details key={section.id} open className="overflow-hidden rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 bg-muted/40 px-4 py-3">
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        {editable ? <Input aria-label="Section name" value={section.name} className="h-8 min-w-0 flex-1 border-transparent bg-transparent font-semibold focus:border-input" onChange={(event) => update({ ...section, name: event.target.value })} /> : <h3 className="min-w-0 flex-1 font-semibold">{section.name}</h3>}
        <RatingBadge rating={inspectionRating([section])} />
        {editable && <Button type="button" size="icon" variant="ghost" title={`Remove ${section.name} section`} aria-label={`Remove ${section.name} section`} onClick={(event) => { event.preventDefault(); onRemove(section.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </summary>
      <div className="divide-y">{section.checkpoints.map((checkpoint) => (
        <div key={checkpoint.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(150px,1fr)_auto_minmax(110px,0.5fr)_minmax(130px,0.6fr)_auto] lg:items-center">
          {editable ? <Input aria-label={`${section.name} checkpoint name`} value={checkpoint.name} className="border-transparent px-0 font-medium focus:border-input focus:px-3" onChange={(event) => update({ ...section, checkpoints: section.checkpoints.map((item) => item.id === checkpoint.id ? { ...item, name: event.target.value } : item) })} /> : <p className="text-sm font-medium">{checkpoint.name}</p>}
          {editable ? <div className="flex flex-wrap gap-1" role="group" aria-label={`${checkpoint.name} condition`}>{(Object.keys(INSPECTION_RATING_LABELS) as InspectionRating[]).map((rating) => <Button key={rating} type="button" size="sm" variant={checkpoint.rating === rating ? "default" : "outline"} aria-pressed={checkpoint.rating === rating} className={cn("h-7 px-2 text-xs", checkpoint.rating === rating && rating === "GOOD" && "bg-green-600 text-white hover:bg-green-700", checkpoint.rating === rating && rating === "AVERAGE" && "bg-amber-600 text-white hover:bg-amber-700", checkpoint.rating === rating && rating === "BAD" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")} onClick={() => update({ ...section, checkpoints: section.checkpoints.map((item) => item.id === checkpoint.id ? { ...item, rating } : item) })}>{INSPECTION_RATING_LABELS[rating]}</Button>)}</div> : <RatingBadge rating={checkpoint.rating} />}
          <Input aria-label={`${checkpoint.name} reading`} placeholder="Reading / unit" value={checkpoint.reading} disabled={!editable} onChange={(event) => update({ ...section, checkpoints: section.checkpoints.map((item) => item.id === checkpoint.id ? { ...item, reading: event.target.value } : item) })} />
          <Input aria-label={`${checkpoint.name} remarks`} placeholder="Remarks" value={checkpoint.remarks} disabled={!editable} onChange={(event) => update({ ...section, checkpoints: section.checkpoints.map((item) => item.id === checkpoint.id ? { ...item, remarks: event.target.value } : item) })} />
          {editable && <Button type="button" variant="ghost" size="icon" className="justify-self-end" title={`Remove ${checkpoint.name}`} aria-label={`Remove ${checkpoint.name}`} onClick={() => onRemove(section.id, checkpoint.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
        </div>
      ))}</div>
      {!section.checkpoints.length && <p className="p-4 text-sm text-muted-foreground">No checkpoints</p>}
      {editable && <div className="border-t px-4 py-3"><Button type="button" variant="outline" size="sm" onClick={() => update({ ...section, checkpoints: [...section.checkpoints, { id: crypto.randomUUID(), name: "New checkpoint", rating: "NOT_CHECKED", reading: "", remarks: "" }] })}><Plus className="mr-2 h-4 w-4" />Add Checkpoint</Button></div>}
    </details>
  ))}</div>;
}