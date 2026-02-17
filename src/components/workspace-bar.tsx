"use client";

import { useWorkspaceStore } from "@/lib/workspace-store";
import { CompanySwitcher } from "./company-switcher";
import { ProjectSwitcher } from "./project-switcher";

export function WorkspaceBar() {
  const activeCompany = useWorkspaceStore((s) => {
    const c = s.companies.find((c) => c.id === s.activeCompanyId);
    return c ?? null;
  });
  const activeProject = useWorkspaceStore((s) => {
    const p = s.projects.find((p) => p.id === s.activeProjectId);
    return p ?? null;
  });

  return (
    <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
      <CompanySwitcher activeCompany={activeCompany} />
      {activeCompany && (
        <ProjectSwitcher activeProject={activeProject} companyId={activeCompany.id} />
      )}
    </div>
  );
}
