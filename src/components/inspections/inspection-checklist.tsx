"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inspectionRating, INSPECTION_RATING_LABELS } from "@/lib/inspection";
import type { InspectionCheckpoint, InspectionRating, InspectionSection } from "@/types/inspection";

export function RatingBadge({ rating }: { rating: InspectionRating }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap",
        rating === "GOOD" && "border-green-600/30 bg-green-500/10 text-green-700 dark:text-green-400",
        rating === "AVERAGE" && "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        rating === "BAD" && "border-destructive/30 bg-destructive/10 text-destructive",
        (rating === "NOT_CHECKED" || rating === "NA") && "border-muted-foreground/20 bg-muted text-muted-foreground"
      )}
    >
      {INSPECTION_RATING_LABELS[rating]}
    </Badge>
  );
}

function CheckpointRow({
  section,
  checkpoint,
  editable,
  onUpdate,
  onRemove,
}: {
  section: InspectionSection;
  checkpoint: InspectionCheckpoint;
  editable: boolean;
  onUpdate: (next: InspectionCheckpoint) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 px-4 py-3.5 sm:space-y-0 sm:grid sm:grid-cols-[minmax(10rem,1.1fr)_minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(8rem,0.9fr)_auto] sm:items-start sm:gap-x-3 sm:gap-y-2">
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">Checkpoint</p>
        {editable ? (
          <Input
            aria-label={`${section.name} checkpoint name`}
            value={checkpoint.name}
            className="h-9 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:border focus-visible:border-input focus-visible:bg-background focus-visible:px-3 focus-visible:shadow-sm"
            onChange={(event) => onUpdate({ ...checkpoint, name: event.target.value })}
          />
        ) : (
          <p className="text-sm font-medium leading-snug text-foreground">{checkpoint.name}</p>
        )}
      </div>

      <div className="min-w-0 space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">Condition</p>
        {editable ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${checkpoint.name} condition`}>
            {(Object.keys(INSPECTION_RATING_LABELS) as InspectionRating[]).map((rating) => (
              <Button
                key={rating}
                type="button"
                size="sm"
                variant={checkpoint.rating === rating ? "default" : "outline"}
                aria-pressed={checkpoint.rating === rating}
                className={cn(
                  "h-7 px-2.5 text-xs",
                  checkpoint.rating === rating && rating === "GOOD" && "bg-green-600 text-white hover:bg-green-700",
                  checkpoint.rating === rating && rating === "AVERAGE" && "bg-amber-600 text-white hover:bg-amber-700",
                  checkpoint.rating === rating && rating === "BAD" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => onUpdate({ ...checkpoint, rating })}
              >
                {INSPECTION_RATING_LABELS[rating]}
              </Button>
            ))}
          </div>
        ) : (
          <RatingBadge rating={checkpoint.rating} />
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">Reading</p>
        <Input
          aria-label={`${checkpoint.name} reading`}
          placeholder="Reading / unit"
          value={checkpoint.reading}
          disabled={!editable}
          className="h-9"
          onChange={(event) => onUpdate({ ...checkpoint, reading: event.target.value })}
        />
      </div>

      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">Remarks</p>
        <Input
          aria-label={`${checkpoint.name} remarks`}
          placeholder="Remarks"
          value={checkpoint.remarks}
          disabled={!editable}
          className="h-9"
          onChange={(event) => onUpdate({ ...checkpoint, remarks: event.target.value })}
        />
      </div>

      {editable ? (
        <div className="flex justify-end sm:pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            title={`Remove ${checkpoint.name}`}
            aria-label={`Remove ${checkpoint.name}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}

export function InspectionChecklist({
  sections,
  editable,
  onChange,
  onRemove,
}: {
  sections: InspectionSection[];
  editable: boolean;
  onChange: (sections: InspectionSection[]) => void;
  onRemove: (sectionId: string, checkpointId?: string) => void;
}) {
  const update = (section: InspectionSection) =>
    onChange(sections.map((item) => (item.id === section.id ? section : item)));

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <details key={section.id} open className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-3 border-b bg-muted/30 px-4 py-3">
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            {editable ? (
              <Input
                aria-label="Section name"
                value={section.name}
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 font-semibold shadow-none focus-visible:border focus-visible:border-input focus-visible:bg-background focus-visible:px-3 focus-visible:shadow-sm"
                onChange={(event) => update({ ...section, name: event.target.value })}
              />
            ) : (
              <h3 className="min-w-0 flex-1 text-sm font-semibold sm:text-base">{section.name}</h3>
            )}
            <RatingBadge rating={inspectionRating([section])} />
            {editable && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                title={`Remove ${section.name} section`}
                aria-label={`Remove ${section.name} section`}
                onClick={(event) => {
                  event.preventDefault();
                  onRemove(section.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </summary>

          <div className="hidden border-b bg-muted/20 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(10rem,1.1fr)_minmax(0,1.4fr)_minmax(7rem,0.7fr)_minmax(8rem,0.9fr)_auto] sm:gap-3">
            <span>Checkpoint</span>
            <span>Condition</span>
            <span>Reading</span>
            <span>Remarks</span>
            <span className="text-right">{editable ? "Action" : ""}</span>
          </div>

          <div className="divide-y">
            {section.checkpoints.map((checkpoint) => (
              <CheckpointRow
                key={checkpoint.id}
                section={section}
                checkpoint={checkpoint}
                editable={editable}
                onUpdate={(next) =>
                  update({
                    ...section,
                    checkpoints: section.checkpoints.map((item) => (item.id === next.id ? next : item)),
                  })
                }
                onRemove={() => onRemove(section.id, checkpoint.id)}
              />
            ))}
          </div>

          {!section.checkpoints.length && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No checkpoints in this section</p>
          )}

          {editable && (
            <div className="border-t bg-muted/10 px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  update({
                    ...section,
                    checkpoints: [
                      ...section.checkpoints,
                      { id: crypto.randomUUID(), name: "New checkpoint", rating: "NOT_CHECKED", reading: "", remarks: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Checkpoint
              </Button>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
