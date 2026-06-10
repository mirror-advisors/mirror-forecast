import { useState, useEffect, useCallback, useMemo } from "react";
import { D0 } from "./data.js";
import { loadData, saveGranular, changedTables } from "./storage.js";

// Owns all forecast-data state: the loaded `d` snapshot, the saved baseline,
// dirty tracking, persistence, and the ⌘S / beforeunload guards. compute()
// consumes the single coherent `d` this returns (never mixed-generation data).
//
// Phase 1: behavior-identical to the old App.jsx inline state. `mutate` is a
// thin alias of `save` here; Phases 2-4 give it granular per-entity writes.
export function useForecastState({ isAdmin, isViewer } = {}) {
  const [d, setD] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadData(D0).then(x => { setD(x); setSaved(x); }); }, []);

  const showToast = useCallback((msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "err" ? 5000 : 2500);
  }, []);

  // save() buffers a draft locally; persist() pushes to Supabase (⌘S / SaveBar).
  // Viewers are no-ops so a read-only role can't write.
  const save = useCallback((nd) => { if (isViewer) return; setD(nd); }, [isViewer]);
  const discard = useCallback(() => { if (isViewer) return; setD(saved); }, [saved, isViewer]);
  const dirty = !!(d && saved && d !== saved);

  // persist() writes ONLY the tables that changed since the last save (granular);
  // client-table bundles route through the atomic RPC inside saveGranular.
  const persist = useCallback(async () => {
    if (isViewer) return;
    if (!d || !dirty || saving) return;
    setSaving(true);
    const result = await saveGranular(d, changedTables(d, saved));
    setSaving(false);
    if (result && result.ok === false) showToast("Save failed — check your connection", "err");
    else { setSaved(d); showToast("Saved ✓", "ok"); }
  }, [d, saved, dirty, saving, showToast, isViewer]);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); persist(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [persist]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Count clients with unsaved edits — drives the "N unsaved changes" pill.
  const dirtyCount = useMemo(() => {
    if (!d || !saved || d === saved) return 0;
    const savedById = new Map((saved.cl || []).map(c => [c.id, JSON.stringify(c)]));
    return (d.cl || []).reduce((n, c) => n + (savedById.get(c.id) === JSON.stringify(c) ? 0 : 1), 0);
  }, [d, saved]);

  const reload = useCallback(() => { loadData(D0).then(x => { setD(x); setSaved(x); }); }, []);

  // Phase 1 stub: behaves like save() (local draft, bulk-persist on ⌘S).
  // Phases 2-4 replace this with per-entity granular writes.
  const mutate = useCallback((nd) => { save(nd); }, [save]);

  return { d, saved, saving, toast, dirty, dirtyCount, save, discard, persist, showToast, reload, mutate, setD, setSaved };
}
