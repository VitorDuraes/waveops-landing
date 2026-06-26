"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ClientFoot, AdminFoot } from "./Foot";
import { CLIENT_NAV, ADMIN_NAV } from "@/lib/nav";

// Shell de 2 colunas (sidebar fixa + area principal) com drawer no mobile.
export function AppShell({ kind, children }: { kind: "client" | "admin"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = kind === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const foot = kind === "admin" ? <AdminFoot /> : <ClientFoot />;
  return (
    <div className="app-root">
      <div className="layout">
        <Sidebar nav={nav} foot={foot} open={open} onNavigate={() => setOpen(false)} />
        <div className="main">
          <Topbar onHamb={() => setOpen(true)} bell={false} search={false} />
          <div className="page">{children}</div>
        </div>
      </div>
      <div
        className={"drawer-scrim" + (open ? " open" : "")}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
    </div>
  );
}
