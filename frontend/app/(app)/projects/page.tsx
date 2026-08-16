"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectsList from "@/components/projects/ProjectsList";
import AddLeadModal from "@/components/projects/AddLeadModal";
import { projectsApi } from "@/lib/api";
import type { ProjectMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";

export default function ProjectsPage() {
  const router = useRouter();
  const [showAddLead, setShowAddLead] = useState(false);
  const { data: meta } = useApiData<ProjectMeta>(() => projectsApi.meta(), []);

  return (
    <>
      <ProjectsList onNewLead={() => setShowAddLead(true)} />
      <AddLeadModal
        open={showAddLead}
        onClose={() => setShowAddLead(false)}
        meta={meta}
        onCreated={id => {
          setShowAddLead(false);
          router.push(`/project/${id}`);
        }}
      />
    </>
  );
}
