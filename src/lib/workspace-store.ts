import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Company {
  id: string;
  name: string;
  createdAt: number;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  createdAt: number;
}

interface WorkspaceState {
  companies: Company[];
  projects: Project[];
  activeCompanyId: string | null;
  activeProjectId: string | null;

  // Combined create+activate actions (single set call, no cascading renders)
  createCompany: (name: string) => string;
  createProject: (companyId: string, name: string) => string;
  setActiveCompany: (id: string) => void;
  setActiveProject: (id: string | null) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      companies: [],
      projects: [],
      activeCompanyId: null,
      activeProjectId: null,

      // Add company AND activate it in a single set() — no cascading renders
      createCompany: (name: string) => {
        const id = generateId();
        set((s) => ({
          companies: [...s.companies, { id, name, createdAt: Date.now() }],
          activeCompanyId: id,
          activeProjectId: null,
        }));
        return id;
      },

      // Add project AND activate it in a single set()
      createProject: (companyId: string, name: string) => {
        const id = generateId();
        set((s) => ({
          projects: [...s.projects, { id, companyId, name, createdAt: Date.now() }],
          activeProjectId: id,
        }));
        return id;
      },

      setActiveCompany: (id: string) => {
        set({ activeCompanyId: id, activeProjectId: null });
      },

      setActiveProject: (id: string | null) => {
        set({ activeProjectId: id });
      },
    }),
    {
      name: "workspace-store-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        companies: s.companies,
        projects: s.projects,
        activeCompanyId: s.activeCompanyId,
        activeProjectId: s.activeProjectId,
      }),
    }
  )
);
