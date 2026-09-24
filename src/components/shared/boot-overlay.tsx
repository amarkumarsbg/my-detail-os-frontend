"use client";

/**
 * Full-screen boot state — same diamond orbit as marketing handoff.
 * Use until auth/bootstrap settles and dashboard chrome can paint.
 */
export function BootOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="workshop-orbit" aria-hidden>
        <span className="workshop-orbit__ring workshop-orbit__ring--outer" />
        <span className="workshop-orbit__ring workshop-orbit__ring--mid" />
        <span className="workshop-orbit__diamond">
          <span className="workshop-orbit__core" />
        </span>
        <span className="workshop-orbit__dot workshop-orbit__dot--a" />
        <span className="workshop-orbit__dot workshop-orbit__dot--b" />
        <span className="workshop-orbit__dot workshop-orbit__dot--c" />
      </div>
    </div>
  );
}
