// Phase E2c.1 — slide-in drawer wrapping ClientDetail.
// Used by Ranked view when a row is clicked.
// Z-index: backdrop 4998, drawer 4999, SaveBar (9999) stays above so Save is clickable.

import React, { useEffect } from "react";
import { P } from "./data.js";
import ClientDetail from "./ClientDetail.jsx";

export default function ClientDrawer({ client, today, onChange, onClose, isAdmin, isViewer }) {
  // Esc to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!client) return null;

  return (
    <>
      {/* Backdrop covers left half (the table area). Click to close. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0, right: "50vw",
          background: "rgba(0,0,0,0.45)",
          zIndex: 4998,
          cursor: "pointer",
        }}
      />
      {/* Drawer pinned to right half */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "50vw",
          minWidth: 480,
          background: P.bg,
          zIndex: 4999,
          boxShadow: "-12px 0 36px rgba(0,0,0,0.55)",
          padding: 18,
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClientDetail
            client={client}
            today={today}
            onChange={onChange}
            onClose={onClose}
            isAdmin={isAdmin}
            isViewer={isViewer}
            narrow={true}
          />
        </div>
      </div>
    </>
  );
}
