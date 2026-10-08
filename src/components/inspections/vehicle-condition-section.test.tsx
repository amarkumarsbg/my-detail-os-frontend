/* @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";
import { VehicleConditionSection } from "./vehicle-condition-section";
import { vehicleConditionArea, vehicleConditionLocationAtSvgPoint } from "@/lib/vehicle-condition-geometry";
import type { VehicleConditionPin } from "@/types/inspection";

afterEach(() => cleanup());
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (typeof PointerEvent === "undefined") vi.stubGlobal("PointerEvent", MouseEvent);
});

const emptyProps = {
  overallCondition: null,
  conditions: [] as VehicleConditionPin[],
  editable: true,
  onOverallConditionChange: vi.fn(),
  onConditionsChange: vi.fn(),
  onClearAll: vi.fn(),
};

describe("vehicle condition", () => {
  it.each([
    [300, 70, "FRONT_BUMPER", "Front Bumper"],
    [300, 110, "HOOD", "Hood"],
    [226, 130, "LEFT_FENDER", "Left Fender"],
    [374, 130, "RIGHT_FENDER", "Right Fender"],
    [300, 158, "WINDSHIELD", "Windshield"],
    [224, 200, "DRIVER_GATE", "Driver Gate"],
    [376, 200, "PASSENGER_GATE", "Passenger Gate"],
    [300, 215, "SUNROOF", "Sunroof"],
    [300, 272, "WINDOWS", "Windows"],
    [224, 265, "LEFT_REAR_PASSENGER_GATE", "Left Side Rear Passenger Gate"],
    [376, 265, "RIGHT_REAR_PASSENGER_GATE", "Right Side Rear Passenger Gate"],
    [224, 310, "LEFT_QUARTER_PANEL", "Left Quarter Panel"],
    [376, 310, "RIGHT_QUARTER_PANEL", "Right Quarter Panel"],
    [300, 316, "TRUNK", "Trunk"],
    [300, 348, "REAR_BUMPER", "Rear Bumper"],
  ] as const)("detects SVG region (%s, %s) as %s", (x, y, location, label) => {
    expect(vehicleConditionLocationAtSvgPoint(x, y)).toBe(location);
    expect(vehicleConditionArea((x / 6), (y / 4.05))).toBe(label);
  });

  it("adds a relative-coordinate pin with the active type and next stable number", () => {
    const onConditionsChange = vi.fn();
    const existing: VehicleConditionPin[] = [{ id: "pin-4", number: 4, type: "SCRATCH", x: 12, y: 18, area: "Front Hood" }];
    render(<VehicleConditionSection {...emptyProps} conditions={existing} onConditionsChange={onConditionsChange} />);
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 100, top: 100, width: 400, height: 200, right: 500, bottom: 300, x: 100, y: 100, toJSON: () => ({}) });
    fireEvent.click(screen.getByRole("button", { name: "Dent" }));
    fireEvent.click(blueprint, { clientX: 300, clientY: 200 });

    expect(onConditionsChange).toHaveBeenCalledWith([
      existing[0],
      expect.objectContaining({ number: 5, type: "DENT", x: 50, y: 50, location: "SUNROOF", area: "Sunroof" }),
    ]);
    expect(screen.getByRole("heading", { name: "Vehicle Condition (1)" })).toBeInTheDocument();
  });

  it("shows the pin name only while hovering and hides it when the pointer leaves", () => {
    const labelText = (text: string) => (_: string, element: Element | null) =>
      Boolean(element && element.textContent === text && element.classList.contains("rounded-full"));
    const condition: VehicleConditionPin = { id: "pin-1", number: 1, type: "DENT", x: 64.2, y: 49.4, location: "PASSENGER_GATE", area: "Passenger Gate" };
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} />);
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    const pin = screen.getByRole("button", { name: "Condition 1: Dent at Passenger Gate" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 100, top: 100, width: 400, height: 200, right: 500, bottom: 300, x: 100, y: 100, toJSON: () => ({}) });

    fireEvent.pointerMove(blueprint, { clientX: 300, clientY: 157 });
    expect(screen.getByText(labelText("Scratch • Hood"))).toBeInTheDocument();
    expect(screen.queryByText(labelText("Dent • Passenger Gate"))).not.toBeInTheDocument();

    fireEvent.pointerEnter(pin);
    expect(screen.getByText(labelText("Dent • Passenger Gate"))).toBeInTheDocument();
    expect(screen.queryByText(labelText("Scratch • Hood"))).not.toBeInTheDocument();

    fireEvent.pointerLeave(pin);
    expect(screen.queryByText(labelText("Dent • Passenger Gate"))).not.toBeInTheDocument();

    fireEvent.pointerLeave(blueprint);
    expect(screen.queryByText(labelText("Scratch • Hood"))).not.toBeInTheDocument();
  });

  it.each([
    ["SCRATCH", "Scratch", "bg-amber-500", "border-amber-400", "bg-amber-500"],
    ["DENT", "Dent", "bg-rose-500", "border-rose-400", "bg-rose-500"],
    ["CRACK", "Crack", "bg-violet-500", "border-violet-400", "bg-violet-500"],
    ["PAINT_CHIP", "Paint Chip", "bg-blue-500", "border-blue-400", "bg-blue-500"],
    ["OTHER", "Other", "bg-slate-500", "border-slate-400", "bg-slate-600"],
  ] as const)("uses the %s color consistently for selector, pin, and condition chip", (type, label, pinColor, chipColor, activeColor) => {
    const condition: VehicleConditionPin = { id: `pin-${type}`, number: 1, type, x: 50, y: 54.3, location: "SUNROOF", area: "Sunroof" };
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} />);

    const selector = screen.getByRole("button", { name: label });
    fireEvent.click(selector);
    expect(selector).toHaveClass(activeColor);
    expect(screen.getByRole("button", { name: `Condition 1: ${label} at Sunroof` })).toHaveClass(pinColor);
    const chip = screen.getAllByText(label).find((element) => element.tagName === "SPAN");
    expect(chip).toHaveClass(chipColor);
  });

  it("selects overall condition and stops pin and delete clicks from placing new pins", () => {
    const condition: VehicleConditionPin = { id: "pin-2", number: 2, type: "CRACK", x: 50, y: 54.3, location: "SUNROOF", area: "Sunroof" };
    const onOverallConditionChange = vi.fn();
    const onConditionsChange = vi.fn();
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} onOverallConditionChange={onOverallConditionChange} onConditionsChange={onConditionsChange} />);
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.click(screen.getByRole("button", { name: "Poor" }));
    fireEvent.click(screen.getByRole("button", { name: "Condition 2: Crack at Sunroof" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Condition 2: Crack at Sunroof" }), { key: "Enter" });
    expect(onOverallConditionChange).toHaveBeenCalledWith("POOR");
    expect(onConditionsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete condition 2" }));
    expect(onConditionsChange).toHaveBeenCalledWith([]);
  });

  it("edits a pin type and remarks without moving its location", async () => {
    const condition: VehicleConditionPin = { id: "pin-1", number: 1, type: "SCRATCH", x: 35.5, y: 42.2, area: "Legacy area" };
    const onConditionsChange = vi.fn();
    const Harness = () => {
      const [conditions, setConditions] = useState([condition]);
      const handleChange = (next: VehicleConditionPin[]) => {
        onConditionsChange(next);
        setConditions(next);
      };
      return <VehicleConditionSection {...emptyProps} conditions={conditions} onConditionsChange={handleChange} />;
    };
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Condition 1: Scratch at Driver Gate" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Condition type for 1" }));
    fireEvent.click(await screen.findByRole("option", { name: "Paint Chip" }));
    expect(onConditionsChange).toHaveBeenLastCalledWith([expect.objectContaining({ ...condition, type: "PAINT_CHIP" })]);

    fireEvent.change(screen.getByRole("textbox", { name: "Condition remarks for 1" }), { target: { value: "Two inch mark" } });
    expect(onConditionsChange).toHaveBeenLastCalledWith([expect.objectContaining({ ...condition, type: "PAINT_CHIP", notes: "Two inch mark" })]);
  });

  it("recalculates the stable region key when dragging a pin to another SVG part", () => {
    const initial: VehicleConditionPin = { id: "pin-drag", number: 1, type: "SCRATCH", x: 50, y: 28.4, location: "HOOD", area: "Hood" };
    const Harness = () => {
      const [conditions, setConditions] = useState([initial]);
      return <VehicleConditionSection {...emptyProps} conditions={conditions} onConditionsChange={setConditions} />;
    };
    render(<Harness />);
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 600, height: 405, right: 600, bottom: 405, x: 0, y: 0, toJSON: () => ({}) });
    const pin = screen.getByRole("button", { name: "Condition 1: Scratch at Hood" });
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 300, clientY: 115 });
    fireEvent.pointerMove(blueprint, { pointerId: 1, clientX: 215, clientY: 200 });
    fireEvent.pointerUp(blueprint, { pointerId: 1, clientX: 215, clientY: 200 });

    expect(screen.getByRole("button", { name: "Condition 1: Scratch at Driver Gate" })).toHaveStyle({ left: "35.8%", top: "49.4%" });
  });

  it("clears all pins without changing overall condition", () => {
    const onClearAll = vi.fn();
    const condition: VehicleConditionPin = { id: "pin-1", number: 1, type: "DENT", x: 70, y: 40, area: "Legacy area" };
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});