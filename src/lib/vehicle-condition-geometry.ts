import type { VehicleConditionLocation } from "@/types/inspection";

type VehicleConditionRegion = { location: VehicleConditionLocation; points: [number, number][] };

export const vehicleConditionLocationLabels: Record<VehicleConditionLocation, string> = {
  FRONT_BUMPER: "Front Bumper",
  REAR_BUMPER: "Rear Bumper",
  HOOD: "Hood",
  TRUNK: "Trunk",
  LEFT_FENDER: "Left Fender",
  RIGHT_FENDER: "Right Fender",
  DRIVER_GATE: "Driver Gate",
  PASSENGER_GATE: "Passenger Gate",
  LEFT_REAR_PASSENGER_GATE: "Left Side Rear Passenger Gate",
  RIGHT_REAR_PASSENGER_GATE: "Right Side Rear Passenger Gate",
  SUNROOF: "Sunroof",
  WINDSHIELD: "Windshield",
  WINDOWS: "Windows",
  LEFT_QUARTER_PANEL: "Left Quarter Panel",
  RIGHT_QUARTER_PANEL: "Right Quarter Panel",
};

/** Older saved pins used coarser side/roof keys — map them onto the expanded panel set. */
const LEGACY_VEHICLE_CONDITION_LOCATIONS: Record<string, VehicleConditionLocation> = {
  ROOF: "SUNROOF",
  REAR_WINDOW: "WINDOWS",
  LEFT_FRONT: "DRIVER_GATE",
  LEFT_REAR: "LEFT_REAR_PASSENGER_GATE",
  RIGHT_FRONT: "PASSENGER_GATE",
  RIGHT_REAR: "RIGHT_REAR_PASSENGER_GATE",
};

export function isVehicleConditionLocation(value: string | null | undefined): value is VehicleConditionLocation {
  return Boolean(value && value in vehicleConditionLocationLabels);
}

export function normalizeVehicleConditionLocation(
  location: string | null | undefined,
  xPercent: number,
  yPercent: number
): VehicleConditionLocation {
  if (isVehicleConditionLocation(location)) return location;
  if (location && location in LEGACY_VEHICLE_CONDITION_LOCATIONS) {
    return LEGACY_VEHICLE_CONDITION_LOCATIONS[location];
  }
  return vehicleConditionLocation(xPercent, yPercent);
}

/** Smooth sedan outline used as the visual body clip / outer stroke. */
export const vehicleConditionBodyPath =
  "M244 69 Q260 52 300 50 Q340 52 356 69 L375 98 Q386 118 390 150 L397 240 Q398 298 376 328 L356 348 Q340 360 300 361 Q260 360 244 348 L224 328 Q202 298 203 240 L210 150 Q214 118 225 98 Z";

/**
 * Organic panel map aligned to the sedan silhouette (600×405).
 * Side panels follow the body curve; glass sits in the cabin.
 */
export const vehicleConditionRegions: VehicleConditionRegion[] = [
  { location: "FRONT_BUMPER", points: [[248, 52], [300, 50], [352, 52], [368, 78], [356, 96], [244, 96], [232, 78]] },
  { location: "HOOD", points: [[246, 98], [300, 82], [354, 98], [352, 138], [248, 138]] },
  { location: "LEFT_FENDER", points: [[214, 100], [246, 98], [248, 148], [238, 168], [214, 160], [208, 128]] },
  { location: "RIGHT_FENDER", points: [[386, 100], [354, 98], [352, 148], [362, 168], [386, 160], [392, 128]] },
  { location: "WINDSHIELD", points: [[246, 142], [300, 132], [354, 142], [360, 176], [240, 176]] },
  { location: "DRIVER_GATE", points: [[208, 168], [240, 168], [244, 236], [220, 242], [206, 228]] },
  { location: "PASSENGER_GATE", points: [[392, 168], [360, 168], [356, 236], [380, 242], [394, 228]] },
  { location: "SUNROOF", points: [[256, 184], [344, 184], [342, 246], [258, 246]] },
  { location: "LEFT_REAR_PASSENGER_GATE", points: [[206, 236], [244, 236], [242, 292], [222, 300], [205, 278]] },
  { location: "RIGHT_REAR_PASSENGER_GATE", points: [[394, 236], [356, 236], [358, 292], [378, 300], [395, 278]] },
  { location: "WINDOWS", points: [[244, 252], [356, 252], [360, 294], [240, 294]] },
  { location: "LEFT_QUARTER_PANEL", points: [[205, 286], [240, 292], [238, 330], [224, 342], [210, 318]] },
  { location: "RIGHT_QUARTER_PANEL", points: [[395, 286], [360, 292], [362, 330], [376, 342], [390, 318]] },
  { location: "TRUNK", points: [[246, 298], [354, 298], [348, 336], [252, 336]] },
  { location: "REAR_BUMPER", points: [[248, 338], [352, 338], [372, 328], [356, 352], [300, 361], [244, 352], [228, 328]] },
];

const GLASS_PANELS = new Set<VehicleConditionLocation>(["WINDSHIELD", "SUNROOF", "WINDOWS"]);

export function vehicleConditionPanelFill(location: VehicleConditionLocation): string {
  if (GLASS_PANELS.has(location)) return "#0c1a2c";
  if (location === "FRONT_BUMPER" || location === "REAR_BUMPER") return "#162438";
  return "#132033";
}

export function vehicleConditionRegionPointsAttr(points: [number, number][]): string {
  return points.map((point) => point.join(",")).join(" ");
}

function distanceToSegmentSquared(point: [number, number], start: [number, number], end: [number, number]): number {
  const [px, py] = point;
  const [sx, sy] = start;
  const [ex, ey] = end;
  const dx = ex - sx;
  const dy = ey - sy;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSquared)) : 0;
  const nearestX = sx + projection * dx;
  const nearestY = sy + projection * dy;
  return (px - nearestX) ** 2 + (py - nearestY) ** 2;
}

function pointInRegion(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const start = polygon[previous];
    const end = polygon[index];
    if (distanceToSegmentSquared(point, start, end) <= 0.5) return true;
    const crosses = (end[1] > point[1]) !== (start[1] > point[1]) &&
      point[0] < ((start[0] - end[0]) * (point[1] - end[1])) / (start[1] - end[1]) + end[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

export function vehicleConditionLocationAtSvgPoint(svgX: number, svgY: number): VehicleConditionLocation {
  const point: [number, number] = [svgX, svgY];
  const containingRegion = vehicleConditionRegions.find((region) => pointInRegion(point, region.points));
  if (containingRegion) return containingRegion.location;

  let closestLocation = vehicleConditionRegions[0].location;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const region of vehicleConditionRegions) {
    let regionDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < region.points.length; index += 1) {
      const start = region.points[index];
      const end = region.points[(index + 1) % region.points.length];
      regionDistance = Math.min(regionDistance, distanceToSegmentSquared(point, start, end));
    }
    if (regionDistance < closestDistance) {
      closestDistance = regionDistance;
      closestLocation = region.location;
    }
  }
  return closestLocation;
}

export function vehicleConditionLocation(xPercent: number, yPercent: number): VehicleConditionLocation {
  return vehicleConditionLocationAtSvgPoint(xPercent * 6, yPercent * 4.05);
}

export function vehicleConditionArea(xPercent: number, yPercent: number): string {
  return vehicleConditionLocationLabels[vehicleConditionLocation(xPercent, yPercent)];
}

/** Shared blueprint markup for PDF — matches the on-screen sedan panel map (600×405). */
export function buildVehicleConditionBlueprintMarkup(highlight?: VehicleConditionLocation | null): string {
  const panels = vehicleConditionRegions.map((region) => {
    const active = highlight === region.location;
    const glass = GLASS_PANELS.has(region.location);
    const fill = active ? "#1a5578" : vehicleConditionPanelFill(region.location);
    const stroke = active ? "#7dd3fc" : glass ? "#3d8fb8" : "#2f6f8f";
    const strokeWidth = active ? 2.2 : glass ? 1.6 : 1.15;
    return `<polygon points="${vehicleConditionRegionPointsAttr(region.points)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }).join("");

  return `
    <defs>
      <pattern id="vehicle-condition-pdf-grid" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#27344a" stroke-width="1"/>
      </pattern>
      <clipPath id="vehicle-condition-pdf-body-clip"><path d="${vehicleConditionBodyPath}"/></clipPath>
    </defs>
    <rect width="600" height="405" fill="#101a2e"/>
    <rect width="600" height="405" fill="url(#vehicle-condition-pdf-grid)"/>
    <g fill="#8da0b8" font-family="Arial, sans-serif" font-size="12" text-anchor="middle">
      <text x="300" y="30">▲ Front (Hood)</text>
      <text x="300" y="384">▼ Rear (Trunk)</text>
      <text x="86" y="214">◀ Left</text>
      <text x="514" y="214">Right ▶</text>
    </g>
    <g clip-path="url(#vehicle-condition-pdf-body-clip)" stroke-linejoin="round">${panels}</g>
    <path d="${vehicleConditionBodyPath}" fill="none" stroke="#22b9ee" stroke-width="2.8" stroke-linejoin="round"/>
    <g fill="#1c334c" stroke="#22b9ee" stroke-width="1.4" stroke-linejoin="round">
      <path d="M214 148 L198 160 L202 174 L218 166 Z"/>
      <path d="M386 148 L402 160 L398 174 L382 166 Z"/>
    </g>
    <g fill="none" stroke="#f5d76e" stroke-width="2.4" stroke-linecap="round">
      <path d="M252 64 L272 56 M328 56 L348 64"/>
    </g>
    <g fill="none" stroke="#f04452" stroke-width="2.4" stroke-linecap="round">
      <path d="M252 344 L270 352 M330 352 L348 344"/>
    </g>
  `;
}
