export type RazorpayCheckoutPayload = {
  provider: "RAZORPAY";
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentId: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay requires a browser"));
  }
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

function unlockPageForRazorpayOverlay(): () => void {
  const body = document.body;
  const html = document.documentElement;
  const prevBodyPe = body.style.pointerEvents;
  const prevHtmlPe = html.style.pointerEvents;
  body.style.pointerEvents = "auto";
  html.style.pointerEvents = "auto";

  // Radix Dialog sets pointer-events:none on body and traps clicks on its overlay.
  // Razorpay Checkout is a sibling iframe — Cards/Netbanking won't select without this.
  const blocked = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-radix-dialog-overlay], [data-radix-dialog-content], [data-radix-focus-guard]"
    )
  );
  const restoreBlocked = blocked.map((el) => {
    const pe = el.style.pointerEvents;
    const vis = el.style.visibility;
    el.style.pointerEvents = "none";
    return () => {
      el.style.pointerEvents = pe;
      el.style.visibility = vis;
    };
  });

  return () => {
    body.style.pointerEvents = prevBodyPe;
    html.style.pointerEvents = prevHtmlPe;
    restoreBlocked.forEach((fn) => fn());
  };
}

/**
 * Opens Razorpay Checkout and resolves with payment ids + signature on success.
 * Rejects if the user closes the modal or the script fails.
 * Note: Razorpay often fires modal.ondismiss after a successful pay — we ignore dismiss once paid.
 */
export async function openRazorpayCheckout(
  checkout: RazorpayCheckoutPayload
): Promise<RazorpaySuccessResponse> {
  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error("Razorpay Checkout is unavailable");
  }

  const key =
    checkout.keyId ||
    (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID : undefined) ||
    "";
  if (!key) {
    throw new Error("Razorpay key is missing");
  }

  const restorePointerEvents = unlockPageForRazorpayOverlay();

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      restorePointerEvents();
      fn();
    };
    const rzp = new window.Razorpay!({
      key,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      order_id: checkout.orderId,
      prefill: checkout.prefill,
      theme: { color: "#fb8612" },
      handler: (response: RazorpaySuccessResponse) => {
        finish(() => resolve(response));
      },
      modal: {
        ondismiss: () => {
          finish(() => reject(new Error("Payment cancelled")));
        },
      },
    });
    rzp.on("payment.failed", (resp: unknown) => {
      const msg =
        typeof resp === "object" &&
        resp &&
        "error" in resp &&
        typeof (resp as { error?: { description?: string } }).error?.description === "string"
          ? (resp as { error: { description: string } }).error.description
          : "Payment failed";
      finish(() => reject(new Error(msg)));
    });
    rzp.open();
  });
}
