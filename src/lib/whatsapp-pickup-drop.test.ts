import { describe, expect, it } from "vitest";
import {
  buildPickupAndDropScheduledWhatsAppMessage,
  buildPickupDropWhatsAppMessage,
} from "./whatsapp-customer-messages";
import type { PickupDropRequest } from "@/types";

const pickup = {
  id: "PND-2026-0009",
  jobCardId: "jc-1",
  jobNumber: "JC-2026-0112",
  type: "PICKUP",
  customerName: "amar kumar",
  customerPhone: "7004509790",
  vehicleMakeModel: "Nissan xyz",
  vehicleRegNumber: "JH78D2312",
  address: "Greater Noida",
  scheduledTime: "2026-08-18T12:33:00.000Z",
  driverName: "Ravi Mechanic",
  status: "PENDING",
  branchId: "br-1",
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:00.000Z",
} as PickupDropRequest;

describe("pickup and drop WhatsApp messages", () => {
  it("writes a pickup scheduled message without raw status codes", () => {
    const text = buildPickupDropWhatsAppMessage(pickup, { businessName: "MY DETAIL OS" });
    expect(text).toMatch(/scheduled a \*pickup\*/i);
    expect(text).not.toMatch(/DRIVER_ASSIGNED|IN_SERVICE/);
  });

  it("writes a drop-off delivered confirmation", () => {
    const text = buildPickupDropWhatsAppMessage(
      {
        ...pickup,
        customerName: "Jaimaiki",
        vehicleMakeModel: "Kia EV6",
        vehicleRegNumber: "UP93BB2222",
        jobNumber: "JC-2026-0203",
        notes: "Auto-created when job reached Ready and pickup is at workshop",
        type: "DROP",
        status: "DELIVERED"
      },
      { businessName: "MY DETAIL OSs" }
    );
    expect(text).toBe(
      "Hi *Jaimaiki*,\n" +
      "\n" +
      "Your vehicle has been *delivered*.\n" +
      "\n" +
      "Vehicle: Kia EV6 (UP93BB2222)\n" +
      "Job Card: *JC-2026-0203*\n" +
      "\n" +
      "Thank you for choosing *MY DETAIL OSs*.\n" +
      "\n" +
      "— MY DETAIL OSs"
    );
  });

  it("combines pickup and drop-off when both are created", () => {
    const drop = { ...pickup, id: "PND-2026-0010", type: "DROP" as const };
    const text = buildPickupAndDropScheduledWhatsAppMessage(pickup, drop, {
      businessName: "MY DETAIL OS",
    });
    expect(text).toMatch(/pickup and drop-off/i);
    expect(text).toContain("Greater Noida");
  });
});
