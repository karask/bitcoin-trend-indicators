"use client";

import { useEffect, useRef, useState } from "react";
import { defaultView, resolveView, viewUrl, type Lab } from "../lib/view-preferences";

export function useSavedView(lab: Lab) {
  const [view, setView] = useState(() => defaultView(lab));
  const [ready, setReady] = useState(false);
  const initial = useRef(true);
  const fromPop = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const restore = () => {
      let saved: unknown = null;
      try { saved = JSON.parse(localStorage.getItem(`regime-view-v1:${lab}`) ?? "null"); } catch { /* Preferences are optional. */ }
      if (!cancelled) { setView(resolveView(lab, saved, new URLSearchParams(window.location.search))); setReady(true); }
    };
    void Promise.resolve().then(restore);
    const pop = () => { fromPop.current = true; restore(); };
    window.addEventListener("popstate", pop);
    return () => { cancelled = true; window.removeEventListener("popstate", pop); };
  }, [lab]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(`regime-view-v1:${lab}`, JSON.stringify(view)); } catch { /* URL remains bookmarkable when storage is disabled. */ }
    const url = viewUrl(lab, view);
    if (initial.current) { window.history.replaceState(window.history.state, "", url); initial.current = false; }
    else if (!fromPop.current && `${window.location.pathname}${window.location.search}` !== url) window.history.pushState(null, "", url);
    fromPop.current = false;
  }, [lab, view, ready]);
  return { view, setView, ready };
}
