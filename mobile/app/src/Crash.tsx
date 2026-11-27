import { Component, type ReactNode } from "react";
import { reportError } from "./lib/core";

/**
 * 4.2.2: if a screen breaks, the person sees a calm page (never a blank one), and the Super Admin gets
 * the report with a picture of the screen at once.
 */
export default class Crash extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError("crash", String(error?.message || error), { stack: String(error?.stack || "").slice(0, 1200), where: String(info?.componentStack || "").slice(0, 1200) }, "crash");
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="splash" role="alert" style={{ gap: 12 }}>
        <img src="./iet-logo.png" alt="" width={84} height={84} />
        <b style={{ fontSize: 20 }}>Something went wrong on this screen</b>
        <p className="mu" style={{ maxWidth: 320, margin: 0 }}>ReqGen has sent a report with a picture of the screen to the Super Admin. Your work is safe in the database.</p>
        <button type="button" className="btn bp" onClick={() => window.location.reload()}>Open ReqGen again</button>
      </div>
    );
  }
}

/** Errors outside a screen (a timer, a promise nobody waited for) are reported too. */
export function watchCrashes() {
  window.addEventListener("error", (e) => {
    if (!e.message || /ResizeObserver loop/.test(e.message)) return;
    reportError("script", e.message, { file: String(e.filename || "").split("/").pop(), line: e.lineno, stack: String(e.error?.stack || "").slice(0, 1200) }, "crash");
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | string | undefined;
    const msg = typeof r === "string" ? r : r?.message || "Unhandled promise";
    if (/Failed to fetch|NetworkError|Load failed|aborted/i.test(msg)) return; // no network is not a bug
    reportError("promise", msg, { stack: typeof r === "object" ? String(r?.stack || "").slice(0, 1200) : undefined }, "error");
  });
}
