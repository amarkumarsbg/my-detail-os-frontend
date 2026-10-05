/* @vitest-environment jsdom */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BusinessIdentityCard } from "./business-identity-card";
import { buildBusinessCardHtml } from "@/lib/business-card-html";

vi.mock("@/store/settings-store", () => ({
  useSettingsStore: (selector: (state: Record<string, string>) => unknown) =>
    selector({
      businessName: "MY DETAIL OS",
      businessLogo: "",
      businessTagline: "Car Wash & Detailing Studio",
      businessPhone: "",
      businessEmail: "",
      businessAddress: "",
      businessWebsite: "",
      gstin: "",
      identityContactName: "",
      brandPrimary: "#315497",
      brandPrimaryPreview: "",
    }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockArtwork() {
  const fetchArtwork = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: "image/svg+xml" }),
  }));
  vi.stubGlobal("fetch", fetchArtwork);
  return fetchArtwork;
}

describe("BusinessIdentityCard download", () => {
  it("exports the actual preview faces with embedded artwork and matching styles", async () => {
    vi.stubGlobal("React", React);
    const fetchArtwork = mockArtwork();
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob);
      return "blob:business-card";
    });
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const { container } = render(<BusinessIdentityCard previewName="Ansh" previewContact="Amar Kumar" previewPhone="918305353862" previewEmail="dbs89652@gmail.com" previewAddress="Studio Road" />);

    fireEvent.click(screen.getByRole("button", { name: "Download card" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    const html = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const exported = new DOMParser().parseFromString(html, "text/html");
    expect(exported.querySelectorAll(".card-frame article")).toHaveLength(2);
    for (const face of ["front", "back"]) {
      const selector = `[data-business-card-face="${face}"]`;
      const preview = container.querySelector<HTMLElement>(selector)!;
      const result = exported.querySelector<HTMLElement>(selector)!;
      expect(result.textContent).toBe(preview.textContent);
      expect(result.style.backgroundColor).toBe(getComputedStyle(preview).backgroundColor);
      expect(result.style.transform).toBe("none");
      expect(result.style.backfaceVisibility).toBe("visible");
    }
    expect(exported.querySelectorAll("[data-contact-key] svg")).toHaveLength(3);
    const images = Array.from(exported.querySelectorAll("img"));
    expect(images).toHaveLength(2);
    expect(images.every((image) => image.src.startsWith("data:image/svg+xml;base64,"))).toBe(true);
    expect(fetchArtwork).toHaveBeenCalledTimes(1);
    expect(exported.body.textContent).toContain("Car Wash & Detailing Studio");
    expect(exported.querySelectorAll(".logo,.identity")).toHaveLength(0);
    const anchor = download.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("visiting-card-amar-kumar.html");

    fireEvent.click(screen.getByRole("button", { name: "Show back", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Download card" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("keeps profile text escaped and does not mutate the preview", async () => {
    mockArtwork();
    const front = document.createElement("article");
    const back = document.createElement("article");
    front.textContent = '<img src=x onerror="alert(1)">';
    front.style.backgroundColor = "rgb(49, 84, 151)";
    back.textContent = "Amar & Kumar";
    back.style.transform = "rotateY(180deg)";
    const html = await buildBusinessCardHtml({ front, back, title: "<script>alert(1)</script>" });
    const exported = new DOMParser().parseFromString(html, "text/html");
    expect(exported.querySelectorAll("img")).toHaveLength(0);
    expect(exported.querySelectorAll("script")).toHaveLength(1);
    expect(exported.querySelector("title")?.textContent).toBe("<script>alert(1)</script> - Business Card");
    expect(exported.querySelector("article")?.textContent).toBe(front.textContent);
    expect(back.style.transform).toBe("rotateY(180deg)");
  });

  it("fails instead of silently substituting a different logo when an asset cannot be embedded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const front = document.createElement("article");
    const back = document.createElement("article");
    const logo = document.createElement("img");
    logo.src = "https://example.com/logo.png";
    front.appendChild(logo);
    await expect(buildBusinessCardHtml({ front, back, title: "Ansh" }))
      .rejects.toThrow("Could not load business card artwork");
  });

  it("embeds the preview font and preserves its dimensions for offline viewing", async () => {
    const fontStyle = document.createElement("style");
    fontStyle.textContent = '@font-face { font-family: "Card Test"; src: url("https://example.com/card.woff2") format("woff2"); }';
    document.head.appendChild(fontStyle);
    const fetchFont = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["font"], { type: "font/woff2" }),
    }));
    vi.stubGlobal("fetch", fetchFont);
    try {
      const front = document.createElement("article");
      const back = document.createElement("article");
      front.style.fontFamily = '"Card Test"';
      front.style.width = "440px";
      front.style.height = "251.42px";
      const html = await buildBusinessCardHtml({ front, back, title: "Ansh" });
      const exported = new DOMParser().parseFromString(html, "text/html");
      expect(exported.querySelector("style")?.textContent).toContain("data:font/woff2;base64,");
      expect(exported.querySelector("style")?.textContent).not.toContain("https://example.com/card.woff2");
      expect(exported.querySelector<HTMLElement>("article")?.style.width).toBe("440px");
      expect(exported.querySelector<HTMLElement>("article")?.style.height).toBe("251.42px");
      expect(fetchFont).toHaveBeenCalledWith("https://example.com/card.woff2");
    } finally {
      fontStyle.remove();
    }
  });
});