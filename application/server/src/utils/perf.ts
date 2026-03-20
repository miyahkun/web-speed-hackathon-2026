import type { Request } from "express";

const enabled = !!process.env["PERF_LOG"];

export function createTimer(label: string, req?: Request) {
  const start = performance.now();
  let last = start;
  const ip = req?.ip ?? null;
  const ua = req?.get("user-agent") ?? null;

  return {
    step(name: string) {
      if (!enabled) return;
      const now = performance.now();
      console.log(JSON.stringify({
        type: "perf",
        label,
        step: name,
        duration: Math.round(now - last),
        ip,
        ua,
      }));
      last = now;
    },
    end() {
      if (!enabled) return;
      console.log(JSON.stringify({
        type: "perf",
        label,
        step: "total",
        duration: Math.round(performance.now() - start),
        ip,
        ua,
      }));
    },
  };
}
