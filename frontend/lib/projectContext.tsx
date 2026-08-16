"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { Project } from "@/lib/apiTypes";

interface ProjectContextType {
  activeProject: Project | null;
  setActiveProject: (p: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextType>({
  activeProject: null,
  setActiveProject: () => {},
});

export function useActiveProject() {
  return useContext(ProjectContext);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);

  const setActiveProject = useCallback((p: Project | null) => {
    setActiveProjectState(p);
  }, []);

  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}
