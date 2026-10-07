/* @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VehicleConditionSection, vehicleConditionArea } from "./vehicle-condition-section";
import type { VehicleConditionPin } from "@/types/inspection";

afterEach(() => cleanup());
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
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
    [50, 10, "Front Hood"],
    [50, 50, "Roof / Windshield"],
    [10, 50, "Left Side"],
    [90, 50, "Right Side"],
    [10, 30, "Front Left"],
    [90, 70, "Rear Right"],
    [50, 95, "Rear / Trunk"],
  ])("maps relative coordinate (%s, %s) to %s", (x, y, area) => {
    expect(vehicleConditionArea(x, y)).toBe(area);
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
      expect.objectContaining({ number: 5, type: "DENT", x: 50, y: 50, area: "Roof / Windshield" }),
    ]);
    expect(screen.getByRole("heading", { name: "Vehicle Condition (1)" })).toBeInTheDocument();
  });

  it.each([
    ["SCRATCH", "Scratch", "bg-amber-500", "border-amber-400", "bg-amber-500"],
    ["DENT", "Dent", "bg-rose-500", "border-rose-400", "bg-rose-500"],
    ["CRACK", "Crack", "bg-violet-500", "border-violet-400", "bg-violet-500"],
    ["PAINT_CHIP", "Paint Chip", "bg-blue-500", "border-blue-400", "bg-blue-500"],
    ["OTHER", "Other", "bg-slate-500", "border-slate-400", "bg-slate-600"],
  ] as const)("uses the %s color consistently for selector, pin, and condition chip", (type, label, pinColor, chipColor, activeColor) => {
    const condition: VehicleConditionPin = { id: `pin-${type}`, number: 1, type, x: 50, y: 50, area: "Roof / Windshield" };
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} />);

    const selector = screen.getByRole("button", { name: label });
    fireEvent.click(selector);
    expect(selector).toHaveClass(activeColor);
    expect(screen.getByRole("button", { name: `Condition 1: ${label} at Roof / Windshield` })).toHaveClass(pinColor);
    const chip = screen.getAllByText(label).find((element) => element.tagName === "SPAN");
    expect(chip).toHaveClass(chipColor);
  });

  it("selects overall condition and stops pin and delete clicks from placing new pins", () => {
    const condition: VehicleConditionPin = { id: "pin-2", number: 2, type: "CRACK", x: 50, y: 50, area: "Roof / Windshield" };
    const onOverallConditionChange = vi.fn();
    const onConditionsChange = vi.fn();
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} onOverallConditionChange={onOverallConditionChange} onConditionsChange={onConditionsChange} />);
    const blueprint = screen.getByRole("group", { name: "Vehicle blueprint" });
    vi.spyOn(blueprint, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.click(screen.getByRole("button", { name: "Poor" }));
    fireEvent.click(screen.getByRole("button", { name: "Condition 2: Crack at Roof / Windshield" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Condition 2: Crack at Roof / Windshield" }), { key: "Enter" });
    expect(onOverallConditionChange).toHaveBeenCalledWith("POOR");
    expect(onConditionsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete condition 2" }));
    expect(onConditionsChange).toHaveBeenCalledWith([]);
  });

  it("edits a selected pin type, area, and remarks without moving the pin", async () => {
    const condition: VehicleConditionPin = { id: "pin-1", number: 1, type: "SCRATCH", x: 35.5, y: 42.2, area: "Roof / Windshield" };
    const onConditionsChange = vi.fn();
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} onConditionsChange={onConditionsChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Condition 1: Scratch at Roof / Windshield" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Condition type for 1" }));
    fireEvent.click(await screen.findByRole("option", { name: "Paint Chip" }));
    expect(onConditionsChange).toHaveBeenLastCalledWith([expect.objectContaining({ ...condition, type: "PAINT_CHIP" })]);

    fireEvent.click(screen.getByRole("combobox", { name: "Condition area for 1" }));
    fireEvent.click(await screen.findByRole("option", { name: "Right Side" }));
    expect(onConditionsChange).toHaveBeenLastCalledWith([expect.objectContaining({ ...condition, area: "Right Side" })]);

    fireEvent.change(screen.getByRole("textbox", { name: "Condition remarks for 1" }), { target: { value: "Two inch mark" } });
    expect(onConditionsChange).toHaveBeenLastCalledWith([expect.objectContaining({ ...condition, notes: "Two inch mark" })]);
  });

  it("clears all pins without changing overall condition", () => {
    const onClearAll = vi.fn();
    const condition: VehicleConditionPin = { id: "pin-1", number: 1, type: "DENT", x: 70, y: 40, area: "Right Side" };
    render(<VehicleConditionSection {...emptyProps} conditions={[condition]} onClearAll={onClearAll} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});