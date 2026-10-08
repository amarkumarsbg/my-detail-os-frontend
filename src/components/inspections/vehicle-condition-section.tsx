"use client";

import { useRef, useState } from "react";
import { CarFront, CircleAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InspectionPreDriveCondition, VehicleConditionLocation, VehicleConditionPin, VehicleConditionType } from "@/types/inspection";
import {
  normalizeVehicleConditionLocation,
  vehicleConditionBodyPath,
  vehicleConditionLocation,
  vehicleConditionLocationLabels,
  vehicleConditionPanelFill,
  vehicleConditionRegionPointsAttr,
  vehicleConditionRegions,
} from "@/lib/vehicle-condition-geometry";

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

const typeLabels = Object.fromEntries(pinTypes.map((item) => [item.value, item.label])) as Record<VehicleConditionType, string>;
const typeColors: Record<VehicleConditionType, { pin: string; chip: string; active: string; row: string }> = {
  SCRATCH: { pin: "bg-amber-500", chip: "border-amber-400 bg-amber-50 text-amber-800", active: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 ring-amber-300", row: "bg-amber-50/70" },
  DENT: { pin: "bg-rose-500", chip: "border-rose-400 bg-rose-50 text-rose-700", active: "border-rose-500 bg-rose-500 text-white hover:bg-rose-600 ring-rose-300", row: "bg-rose-50/70" },
  CRACK: { pin: "bg-violet-500", chip: "border-violet-400 bg-violet-50 text-violet-700", active: "border-violet-500 bg-violet-500 text-white hover:bg-violet-600 ring-violet-300", row: "bg-violet-50/70" },
  PAINT_CHIP: { pin: "bg-blue-500", chip: "border-blue-400 bg-blue-50 text-blue-700", active: "border-blue-500 bg-blue-500 text-white hover:bg-blue-600 ring-blue-300", row: "bg-blue-50/70" },
  OTHER: { pin: "bg-slate-500", chip: "border-slate-400 bg-slate-50 text-slate-700", active: "border-slate-500 bg-slate-600 text-white hover:bg-slate-700 ring-slate-300", row: "bg-slate-50/80" },
};

function conditionLocation(condition: VehicleConditionPin): VehicleConditionLocation {
  return normalizeVehicleConditionLocation(condition.location, condition.x, condition.y);
}

function conditionArea(condition: VehicleConditionPin): string {
  return vehicleConditionLocationLabels[conditionLocation(condition)] || condition.area;
}

function newConditionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `condition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Keep the floating pin label inside the blueprint while flipping above/below the pin. */
function pinTooltipPlacement(x: number, y: number): { className: string; style: { left: string; top: string } } {
  const clampedX = Math.min(86, Math.max(14, x));
  const below = y < 16;
  return {
    className: `pointer-events-none absolute z-20 -translate-x-1/2 ${below ? "translate-y-5" : "-translate-y-[calc(100%+0.7rem)]"}`,
    style: { left: `${clampedX}%`, top: `${y}%` },
  };
}

function PinNameTooltip({
  type,
  area,
  x,
  y,
}: {
  type: VehicleConditionType;
  area: string;
  x: number;
  y: number;
}) {
  const placement = pinTooltipPlacement(x, y);
  return (
    <div className={placement.className} style={placement.style} aria-live="polite">
      <span className="whitespace-nowrap rounded-full bg-slate-950/90 px-3 py-1.5 text-sm text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
        <span className="font-semibold">{typeLabels[type]}</span><span className="text-white/55"> • </span><span className="font-normal text-white/90">{area}</span>
      </span>
    </div>
  );
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
  const [hoveredLocation, setHoveredLocation] = useState<VehicleConditionLocation | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const draggingPinId = useRef<string | null>(null);
  const suppressCanvasClick = useRef(false);
  const activePinId = conditions.find((condition) => condition.id === selectedPinId)?.id ?? conditions.at(-1)?.id;
  const hoveredPin = conditions.find((condition) => condition.id === hoveredPinId);

  const addPin = (x: number, y: number) => {
    if (!editable) return;
    const roundedX = Number(Math.min(100, Math.max(0, x)).toFixed(1));
    const roundedY = Number(Math.min(100, Math.max(0, y)).toFixed(1));
    const location = vehicleConditionLocation(roundedX, roundedY);
    const nextNumber = Math.max(0, ...conditions.map((condition) => condition.number)) + 1;
    const id = newConditionId();
    onConditionsChange([...conditions, {
      id,
      number: nextNumber,
      type: activeType,
      x: roundedX,
      y: roundedY,
      location,
      area: vehicleConditionLocationLabels[location],
    }]);
    setSelectedPinId(id);
  };

  const updateCondition = (id: string, changes: Partial<VehicleConditionPin>) => {
    onConditionsChange(conditions.map((condition) => condition.id === id ? { ...condition, ...changes } : condition));
  };

  const handleBlueprintClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressCanvasClick.current) {
      suppressCanvasClick.current = false;
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    addPin(((event.clientX - bounds.left) / bounds.width) * 100, ((event.clientY - bounds.top) / bounds.height) * 100);
  };

  const handleBlueprintPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Number(Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)).toFixed(1));
    const y = Number(Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)).toFixed(1));
    const location = vehicleConditionLocation(x, y);
    setHoveredLocation(location);
    const draggingId = draggingPinId.current;
    if (editable && draggingId) {
      updateCondition(draggingId, { x, y, location, area: vehicleConditionLocationLabels[location] });
    }
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
        <div className="min-w-0 space-y-2">
        <div
          className={`relative aspect-[1.48] min-h-64 overflow-hidden rounded-xl border border-slate-700 bg-[#101a2e] ${editable ? "cursor-crosshair" : ""}`}
          role="group"
          aria-label="Vehicle blueprint"
          tabIndex={editable ? 0 : -1}
          onClick={handleBlueprintClick}
          onPointerMove={handleBlueprintPointerMove}
          onPointerUp={() => { draggingPinId.current = null; }}
          onPointerCancel={() => { draggingPinId.current = null; }}
          onPointerLeave={() => { setHoveredLocation(null); setHoveredPinId(null); }}
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
              <clipPath id="vehicle-condition-body-clip">
                <path d={vehicleConditionBodyPath} />
              </clipPath>
            </defs>
            <rect width="600" height="405" fill="url(#vehicle-condition-grid)" />
            <g fill="#8da0b8" fontFamily="Arial, sans-serif" fontSize="12" textAnchor="middle">
              <text x="300" y="30">▲ Front (Hood)</text>
              <text x="300" y="384">▼ Rear (Trunk)</text>
              <text x="86" y="214">◀ Left</text>
              <text x="514" y="214">Right ▶</text>
            </g>
            <g clipPath="url(#vehicle-condition-body-clip)" strokeLinejoin="round">
              {vehicleConditionRegions.map((region) => {
                const active = editable && hoveredLocation === region.location;
                const glass = region.location === "WINDSHIELD" || region.location === "SUNROOF" || region.location === "WINDOWS";
                return (
                  <polygon
                    key={region.location}
                    points={vehicleConditionRegionPointsAttr(region.points)}
                    fill={active ? "#1a5578" : vehicleConditionPanelFill(region.location)}
                    stroke={active ? "#7dd3fc" : glass ? "#3d8fb8" : "#2f6f8f"}
                    strokeWidth={active ? 2.2 : glass ? 1.6 : 1.15}
                  />
                );
              })}
            </g>
            <path d={vehicleConditionBodyPath} fill="none" stroke="#22b9ee" strokeWidth="2.8" strokeLinejoin="round" />
            <g fill="#1c334c" stroke="#22b9ee" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M214 148 L198 160 L202 174 L218 166 Z" />
              <path d="M386 148 L402 160 L398 174 L382 166 Z" />
            </g>
            <g fill="none" stroke="#f5d76e" strokeWidth="2.4" strokeLinecap="round">
              <path d="M252 64 L272 56 M328 56 L348 64" />
            </g>
            <g fill="none" stroke="#f04452" strokeWidth="2.4" strokeLinecap="round">
              <path d="M252 344 L270 352 M330 352 L348 344" />
            </g>
          </svg>
          {hoveredPin && (
            <PinNameTooltip
              type={hoveredPin.type}
              area={conditionArea(hoveredPin)}
              x={hoveredPin.x}
              y={hoveredPin.y}
            />
          )}
          {editable && !hoveredPin && hoveredLocation && (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-center" aria-live="polite">
              <span className="rounded-full bg-slate-950/85 px-3 py-1 text-sm text-white shadow-sm ring-1 ring-white/10">
                <span className="font-semibold">{typeLabels[activeType]}</span><span className="text-white/55"> • </span><span className="font-normal text-white/90">{vehicleConditionLocationLabels[hoveredLocation]}</span>
              </span>
            </div>
          )}
          {conditions.map((condition) => {
            const isHovered = condition.id === hoveredPinId;
            return (
              <button
                key={condition.id}
                type="button"
                aria-label={`Condition ${condition.number}: ${typeLabels[condition.type]} at ${conditionArea(condition)}`}
                className={`absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white ${typeColors[condition.type].pin} text-xs font-bold text-white shadow-md transition-[box-shadow,transform] ${isHovered ? "z-30 scale-110 ring-4 ring-sky-300/80 shadow-[0_0_0_8px_rgba(125,211,252,0.22)]" : ""}`}
                style={{ left: `${condition.x}%`, top: `${condition.y}%` }}
                onPointerEnter={() => setHoveredPinId(condition.id)}
                onPointerLeave={() => {
                  if (draggingPinId.current === condition.id) return;
                  setHoveredPinId((current) => (current === condition.id ? null : current));
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedPinId(condition.id);
                  setHoveredPinId(condition.id);
                  if (!editable) return;
                  draggingPinId.current = condition.id;
                  suppressCanvasClick.current = true;
                  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture may be unavailable in test and embedded browsers */ }
                }}
                onPointerUp={() => {
                  if (draggingPinId.current === condition.id) draggingPinId.current = null;
                }}
                onClick={(event) => { event.stopPropagation(); suppressCanvasClick.current = false; setSelectedPinId(condition.id); }}
              >
                {condition.number}
              </button>
            );
          })}
        </div>
        {!conditions.length && (
          <p className="text-center text-xs text-muted-foreground">Select a damage type, then mark its location on the vehicle</p>
        )}
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
                    <span className="mt-1 block text-sm font-medium leading-tight">{conditionArea(condition)}</span>
                  </span>
                  {editable && <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Delete condition ${condition.number}`} onClick={() => onConditionsChange(conditions.filter((item) => item.id !== condition.id))}><Trash2 className="size-4" /></Button>}
                  {editable && condition.id === activePinId && (
                    <div className="col-span-3 grid grid-cols-1 gap-2 border-t border-border/70 pt-2 sm:grid-cols-2">
                      <Select value={condition.type} onValueChange={(value) => updateCondition(condition.id, { type: value as VehicleConditionType })}>
                        <SelectTrigger aria-label={`Condition type for ${condition.number}`} className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{pinTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <span className="flex h-9 min-w-0 items-center truncate rounded-md border bg-background px-3 text-sm" aria-label={`Detected area for ${condition.number}`}>
                        {conditionArea(condition)}
                      </span>
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