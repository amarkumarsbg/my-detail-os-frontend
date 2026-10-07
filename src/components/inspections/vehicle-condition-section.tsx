"use client";

import { useState } from "react";
import { CarFront, CircleAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InspectionPreDriveCondition, VehicleConditionPin, VehicleConditionType } from "@/types/inspection";

const pinTypes: { value: VehicleConditionType; label: string }[] = [
  { value: "SCRATCH", label: "Scratch" },
  { value: "DENT", label: "Dent" },
  { value: "CRACK", label: "Crack" },
  { value: "PAINT_CHIP", label: "Paint Chip" },
  { value: "OTHER", label: "Other" },
];

const overallOptions: { value: InspectionPreDriveCondition; label: string }[] = [
  { value: "GOOD", label: "Good" },
  { value: "FAIR", label: "Fair" },
  { value: "POOR", label: "Poor" },
];

const conditionAreas = ["Front Hood", "Roof / Windshield", "Rear / Trunk", "Left Side", "Right Side", "Front Left", "Front Right", "Rear Left", "Rear Right"];
const typeLabels = Object.fromEntries(pinTypes.map((item) => [item.value, item.label])) as Record<VehicleConditionType, string>;
const typeColors: Record<VehicleConditionType, { pin: string; chip: string; active: string; row: string }> = {
  SCRATCH: { pin: "bg-amber-500", chip: "border-amber-400 bg-amber-50 text-amber-800", active: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 ring-amber-300", row: "bg-amber-50/70" },
  DENT: { pin: "bg-rose-500", chip: "border-rose-400 bg-rose-50 text-rose-700", active: "border-rose-500 bg-rose-500 text-white hover:bg-rose-600 ring-rose-300", row: "bg-rose-50/70" },
  CRACK: { pin: "bg-violet-500", chip: "border-violet-400 bg-violet-50 text-violet-700", active: "border-violet-500 bg-violet-500 text-white hover:bg-violet-600 ring-violet-300", row: "bg-violet-50/70" },
  PAINT_CHIP: { pin: "bg-blue-500", chip: "border-blue-400 bg-blue-50 text-blue-700", active: "border-blue-500 bg-blue-500 text-white hover:bg-blue-600 ring-blue-300", row: "bg-blue-50/70" },
  OTHER: { pin: "bg-slate-500", chip: "border-slate-400 bg-slate-50 text-slate-700", active: "border-slate-500 bg-slate-600 text-white hover:bg-slate-700 ring-slate-300", row: "bg-slate-50/80" },
};

export function vehicleConditionArea(x: number, y: number): string {
  const horizontal = Math.min(100, Math.max(0, x));
  const vertical = Math.min(100, Math.max(0, y));
  if (vertical <= 20) return "Front Hood";
  if (vertical >= 80) return "Rear / Trunk";
  if (horizontal <= 24) {
    if (vertical <= 40) return "Front Left";
    if (vertical >= 60) return "Rear Left";
    return "Left Side";
  }
  if (horizontal >= 76) {
    if (vertical <= 40) return "Front Right";
    if (vertical >= 60) return "Rear Right";
    return "Right Side";
  }
  if (vertical <= 36) return horizontal < 50 ? "Front Left" : "Front Right";
  if (vertical >= 64) return horizontal < 50 ? "Rear Left" : "Rear Right";
  return "Roof / Windshield";
}

function newConditionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `condition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function VehicleConditionSection({
  overallCondition,
  conditions,
  editable,
  onOverallConditionChange,
  onConditionsChange,
  onClearAll,
}: {
  overallCondition: InspectionPreDriveCondition | null | undefined;
  conditions: VehicleConditionPin[];
  editable: boolean;
  onOverallConditionChange: (condition: InspectionPreDriveCondition) => void;
  onConditionsChange: (conditions: VehicleConditionPin[]) => void;
  onClearAll: () => void;
}) {
  const [activeType, setActiveType] = useState<VehicleConditionType>("SCRATCH");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const activePinId = conditions.find((condition) => condition.id === selectedPinId)?.id ?? conditions.at(-1)?.id;

  const addPin = (x: number, y: number) => {
    if (!editable) return;
    const roundedX = Number(Math.min(100, Math.max(0, x)).toFixed(1));
    const roundedY = Number(Math.min(100, Math.max(0, y)).toFixed(1));
    const nextNumber = Math.max(0, ...conditions.map((condition) => condition.number)) + 1;
    const id = newConditionId();
    onConditionsChange([...conditions, {
      id,
      number: nextNumber,
      type: activeType,
      x: roundedX,
      y: roundedY,
      area: vehicleConditionArea(roundedX, roundedY),
    }]);
    setSelectedPinId(id);
  };

  const updateCondition = (id: string, changes: Partial<VehicleConditionPin>) => {
    onConditionsChange(conditions.map((condition) => condition.id === id ? { ...condition, ...changes } : condition));
  };

  const handleBlueprintClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    addPin(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
  };

  return (
    <section className="space-y-4 border-t pt-5" aria-labelledby="vehicle-condition-title">
      <div>
        <h2 id="vehicle-condition-title" className="text-base font-semibold">Vehicle Condition ({conditions.length})</h2>
        <p className="mt-1 text-sm text-muted-foreground">Record visible exterior condition before the inspection.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
        <div>
          <h3 className="text-sm font-semibold">Overall Pre-Drive Condition</h3>
          <p className="text-sm text-muted-foreground">General visual condition of the vehicle exterior</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Overall pre-drive condition">
          {overallOptions.map((option) => {
            const selected = overallCondition === option.value;
            const color = option.value === "GOOD"
              ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              : option.value === "FAIR"
                ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600"
                : "border-red-600 bg-red-600 text-white hover:bg-red-700";
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                aria-pressed={selected}
                disabled={!editable}
                className={selected ? color : ""}
                onClick={() => onOverallConditionChange(option.value)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        <CarFront className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="mr-1 text-sm font-medium">Active pin type:</span>
        {pinTypes.map((type) => (
          <Button
            key={type.value}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={activeType === type.value}
            disabled={!editable}
            className={activeType === type.value ? `ring-2 ring-offset-1 ${typeColors[type.value].active}` : ""}
            onClick={() => setActiveType(type.value)}
          >
            {type.label}
          </Button>
        ))}
        <span className="ml-auto text-xs italic text-muted-foreground">Click anywhere on vehicle blueprint to place pin</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.8fr)]">
        <div
          className={`relative aspect-[1.48] min-h-64 overflow-hidden rounded-xl border border-slate-700 bg-[#101a2e] ${editable ? "cursor-crosshair" : ""}`}
          role="group"
          aria-label="Vehicle blueprint"
          tabIndex={editable ? 0 : -1}
          onClick={handleBlueprintClick}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (editable && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              addPin(50, 50);
            }
          }}
        >
          <svg viewBox="0 0 600 405" className="pointer-events-none absolute inset-0 size-full" role="img" aria-label="Top view vehicle blueprint">
            <defs>
              <pattern id="vehicle-condition-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#27344a" strokeWidth="1" />
              </pattern>
              <linearGradient id="vehicle-body" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#1d2b42" />
                <stop offset="1" stopColor="#121e32" />
              </linearGradient>
            </defs>
            <rect width="600" height="405" fill="url(#vehicle-condition-grid)" />
            <g fill="#8da0b8" fontFamily="Arial, sans-serif" fontSize="12" textAnchor="middle">
              <text x="300" y="32">Front (Hood)</text>
              <text x="300" y="386">Rear (Trunk)</text>
              <text x="95" y="208">Left Side</text>
              <text x="505" y="208">Right Side</text>
            </g>
            <g fill="url(#vehicle-body)" stroke="#22b9ee" strokeWidth="3" strokeLinejoin="round">
              <path d="M244 69 Q260 53 300 52 Q340 53 356 69 L375 98 Q386 119 390 155 L397 245 Q398 300 375 327 L356 347 Q340 359 300 360 Q260 359 244 347 L225 327 Q202 300 203 245 L210 155 Q214 119 225 98 Z" />
              <path d="M232 103 Q300 78 368 103 L360 138 Q300 126 240 138 Z" fill="#102a42" />
              <path d="M239 151 Q300 138 361 151 L369 182 L231 182 Z" fill="#18334a" />
              <path d="M235 191 Q300 186 365 191 L359 267 Q300 276 241 267 Z" fill="#0b1728" />
              <path d="M241 278 Q300 287 359 278 L368 316 Q300 338 232 316 Z" fill="#18334a" />
              <path d="M220 151 L207 165 L211 177 L225 171 M380 151 L393 165 L389 177 L375 171" fill="#34516c" />
            </g>
            <g fill="none" stroke="#22b9ee" strokeWidth="2">
              <path d="M228 145 L372 145 M229 274 L371 274" />
              <path d="M249 105 L258 139 M351 105 L342 139 M248 281 L257 316 M352 281 L343 316" />
            </g>
            <g fill="none" stroke="#f04452" strokeWidth="2.5" strokeLinecap="round">
              <path d="M231 324 L257 333 M369 324 L343 333" />
            </g>
          </svg>
          {conditions.map((condition) => (
            <button
              key={condition.id}
              type="button"
              aria-label={`Condition ${condition.number}: ${typeLabels[condition.type]} at ${condition.area}`}
              title={`${typeLabels[condition.type]} - ${condition.area}`}
              className={`absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white ${typeColors[condition.type].pin} text-xs font-bold text-white shadow-md ${condition.id === activePinId ? "ring-4 ring-sky-400/80" : ""}`}
              style={{ left: `${condition.x}%`, top: `${condition.y}%` }}
              onClick={(event) => { event.stopPropagation(); setSelectedPinId(condition.id); }}
            >
              {condition.number}
            </button>
          ))}
          {!conditions.length && <span className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-slate-400">Select a damage type, then mark its location</span>}
        </div>

        <aside className="overflow-hidden rounded-lg border" aria-label="Noted vehicle conditions">
          <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CircleAlert className="size-4 text-amber-600" />Noted conditions ({conditions.length})</h3>
            {conditions.length > 0 && editable && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onClearAll}>Clear All</Button>}
          </div>
          {conditions.length ? (
            <ul className="max-h-[405px] divide-y overflow-y-auto px-2">
              {conditions.map((condition) => (
                <li key={condition.id} className={`grid min-h-16 grid-cols-[1.5rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-2 px-2 py-2 ${condition.id === activePinId ? typeColors[condition.type].row : ""}`}>
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${typeColors[condition.type].pin} text-xs font-bold text-white`}>{condition.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${typeColors[condition.type].chip}`}>{typeLabels[condition.type]}</span>
                    <span className="mt-1 block text-sm font-medium leading-tight">{condition.area || vehicleConditionArea(condition.x, condition.y)}</span>
                  </span>
                  {editable && <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Delete condition ${condition.number}`} onClick={() => onConditionsChange(conditions.filter((item) => item.id !== condition.id))}><Trash2 className="size-4" /></Button>}
                  {editable && condition.id === activePinId && (
                    <div className="col-span-3 grid grid-cols-1 gap-2 border-t border-border/70 pt-2 sm:grid-cols-2">
                      <Select value={condition.type} onValueChange={(value) => updateCondition(condition.id, { type: value as VehicleConditionType })}>
                        <SelectTrigger aria-label={`Condition type for ${condition.number}`} className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{pinTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={condition.area || vehicleConditionArea(condition.x, condition.y)} onValueChange={(area) => updateCondition(condition.id, { area })}>
                        <SelectTrigger aria-label={`Condition area for ${condition.number}`} className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{conditionAreas.map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input
                        className="h-9 sm:col-span-2"
                        aria-label={`Condition remarks for ${condition.number}`}
                        placeholder="Optional remarks"
                        value={condition.notes ?? ""}
                        onChange={(event) => updateCondition(condition.id, { notes: event.target.value })}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground"><CircleAlert className="size-5" />No conditions noted</div>
          )}
        </aside>
      </div>
    </section>
  );
}