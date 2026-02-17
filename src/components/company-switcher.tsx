"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceStore, Company } from "@/lib/workspace-store";

interface CompanySwitcherProps {
  activeCompany: Company | null;
}

export function CompanySwitcher({ activeCompany }: CompanySwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const companies = useWorkspaceStore((s) => s.companies);
  const addCompany = useWorkspaceStore((s) => s.addCompany);
  const setActiveCompany = useWorkspaceStore((s) => s.setActiveCompany);

  const handleSelect = (id: string) => {
    if (id !== activeCompany?.id) {
      setActiveCompany(id);
    }
    setOpen(false);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addCompany(name);
    setNewName("");
    setCreating(false);
    setOpen(false);
    // Defer company activation to avoid update cascade with Popover closing
    requestAnimationFrame(() => setActiveCompany(id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <span>{activeCompany?.name ?? "No workspace"}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-0">
        <div className="p-2">
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider px-2 py-1">
            Workspaces
          </div>
          {companies.length === 0 && !creating && (
            <div className="px-2 py-3 text-center font-mono text-[11px] text-muted-foreground/50">
              No workspaces yet
            </div>
          )}
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors ${
                c.id === activeCompany?.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.id === activeCompany?.id ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              {c.name}
            </button>
          ))}
          {creating ? (
            <div className="mt-1 flex items-center gap-1 px-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Company name..."
                className="flex-1 rounded-md border border-border bg-transparent px-2 py-1 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                className="rounded-md bg-foreground px-2 py-1 font-mono text-[10px] text-background hover:bg-foreground/90"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New workspace
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
