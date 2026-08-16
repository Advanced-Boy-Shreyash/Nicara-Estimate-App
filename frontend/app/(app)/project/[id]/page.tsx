"use client";

import { useParams, useRouter } from "next/navigation";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { useActiveProject } from "@/lib/projectContext";
import { projectsApi } from "@/lib/api";
import type { ProjectMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setActiveProject } = useActiveProject();
  const { data: meta } = useApiData<ProjectMeta>(() => projectsApi.meta(), []);
  const projectId = Number(params.id);

  if (!projectId || isNaN(projectId)) {
    router.replace("/projects");
    return null;
  }

  return (
    <ProjectDetail
      projectId={projectId}
      meta={meta}
      onBack={() => router.push("/projects")}
      onProject={setActiveProject}
    />
  );
}
