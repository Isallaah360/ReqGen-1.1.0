"use client";

import { useEffect, useState } from "react";
import { appInfo, isApp } from "./native";

/** True inside the ReqGen Android app (after the first paint), with the app's own version. */
export function useApp() {
  const [state, setState] = useState<{ app: boolean; version: string | null; build: number }>({ app: false, version: null, build: 0 });
  useEffect(() => {
    if (!isApp()) return;
    queueMicrotask(() => setState((s) => ({ ...s, app: true })));
    void appInfo().then((i) => { if (i) setState({ app: true, version: i.version, build: i.build }); });
  }, []);
  return state;
}
