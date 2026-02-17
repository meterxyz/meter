"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspaceStore, Project } from "@/lib/workspace-store";

interface ProjectSwitcherProps {
  activeProject: Project | null;
  companyId: string;
}

export function ProjectSwitcher({ activeProject, companyId }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const projects = useWorkspaceStore((s) => s.projects.filter((p) => p.companyId === companyId));
  const addProject = useWorkspaceStore((s) => s.addProject);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);

  const handleSelect = (id: string | null) => {
    setActiveProject(id);
    setOpen(false);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = addProject(companyId, name);
    setActiveProject(id);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <span>{activeProject?.name ?? "All tracks"}</span>
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
      <PopoverContent side="top" align="end" className="w-52 p-0">
        <div className="p-2">
          <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider px-2 py-1">
            Tracks
          </div>
          <button
            onClick={() => handleSelect(null)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors ${
              !activeProject
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${!activeProject ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
            All tracks
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[11px] transition-colors ${
                p.id === activeProject?.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${p.id === activeProject?.id ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              {p.name}
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
                placeholder="Track name..."
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
              New track
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
