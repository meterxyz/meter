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

  addCompany: (name: string) => string;
  addProject: (companyId: string, name: string) => string;
  setActiveCompany: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  getActiveCompany: () => Company | null;
  getActiveProject: () => Project | null;
  getProjectsForCompany: (companyId: string) => Project[];
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      companies: [],
      projects: [],
      activeCompanyId: null,
      activeProjectId: null,

      addCompany: (name: string) => {
        const id = generateId();
        set((s) => ({
          companies: [...s.companies, { id, name, createdAt: Date.now() }],
        }));
        return id;
      },

      addProject: (companyId: string, name: string) => {
        const id = generateId();
        set((s) => ({
          projects: [...s.projects, { id, companyId, name, createdAt: Date.now() }],
        }));
        return id;
      },

      setActiveCompany: (id: string) => {
        set({ activeCompanyId: id, activeProjectId: null });
      },

      setActiveProject: (id: string | null) => {
        set({ activeProjectId: id });
      },

      getActiveCompany: () => {
        const { companies, activeCompanyId } = get();
        return companies.find((c) => c.id === activeCompanyId) ?? null;
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId) ?? null;
      },

      getProjectsForCompany: (companyId: string) => {
        return get().projects.filter((p) => p.companyId === companyId);
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
