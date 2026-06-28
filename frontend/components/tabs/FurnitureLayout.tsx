"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import ApprovalWidget from "@/components/ui/ApprovalWidget";
import RefImages from "@/components/ui/RefImages";
import SendBar from "@/components/ui/SendBar";
import { SHARE_DESIGNS_EMAIL, DESIGN_SIGNOFF_EMAIL } from "@/lib/constants";
import type { LayoutVersion } from "@/lib/types";

const INIT_VERSIONS: LayoutVersion[] = [
  { id: "v1", label: "Layout v1.0", date: "10 Apr 2026", uploadedBy: "Ananya", file: "layout_v1.pdf", notes: "Initial furniture layout", status: "approved", comment: "Looks great — approved by client" },
  { id: "v2", label: "Layout v1.1 (revision)", date: "18 Apr 2026", uploadedBy: "Ananya", file: "layout_v1.1.pdf", notes: "Revised wardrobe sizing", status: "denied", comment: "Please check wardrobe depth" },
  { id: "v3", label: "Layout v2.0", date: "25 Apr 2026", uploadedBy: "Karan", file: "layout_v2.pdf", notes: "Updated per client feedback", status: "pending", comment: "" },
];

export default function FurnitureLayout() {
  const [sub, setSub] = useState<"versions" | "refs" | "approval">("versions");
  const [versions, setVersions] = useState<LayoutVersion[]>(INIT_VERSIONS);

  const approve = (id: string, comment: string) =>
    setVersions((p) =>
      p.map((v) => (v.id === id ? { ...v, status: "approved" as const, comment } : v))
    );

  const deny = (id: string, comment: string) =>
    setVersions((p) =>
      p.map((v) => (v.id === id ? { ...v, status: "denied" as const, comment } : v))
    );

  const latestPending = versions.find((v) => v.status === "pending");

  return (
    <div className="animate-fade-in">
      {/* Header with sub-tabs */}
      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="flex border-b border-nicara-light flex-1">
          {(
            [
              ["versions", "Layout Versions"],
              ["refs", "Client References"],
              ["approval", "Send for Approval"],
            ] as const
          ).map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={`px-4 py-2 bg-transparent border-none text-[13px] cursor-pointer transition-colors ${
                sub === id
                  ? "text-nicara-gold border-b-2 border-nicara-gold font-bold"
                  : "text-stone-500 border-b-2 border-transparent"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <SendBar
          phone="9810011111"
          emails={[
            { label: "Share Designs", subject: SHARE_DESIGNS_EMAIL.subject, body: SHARE_DESIGNS_EMAIL.body },
            { label: "Design Sign-Off", subject: DESIGN_SIGNOFF_EMAIL.subject, body: DESIGN_SIGNOFF_EMAIL.body },
          ]}
        />
      </div>

      {/* Versions */}
      {sub === "versions" && (
        <div>
          <SectionHeader title="Layout Versions" />
          <div className="flex flex-col gap-2.5 mb-5">
            {versions.map((v) => (
              <Card key={v.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                      v.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : v.status === "denied"
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {v.status === "approved"
                      ? "✓"
                      : v.status === "denied"
                      ? "✗"
                      : "⏳"}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-nicara-dark">
                      {v.label}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      {v.date} · {v.uploadedBy} · {v.notes}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      v.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : v.status === "denied"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                  <button className="px-3 py-1 bg-nicara-dark border-none rounded-lg text-[11px] text-stone-200 cursor-pointer font-semibold hover:bg-nicara-gold hover:text-white transition-all">
                    View →
                  </button>
                </div>
              </Card>
            ))}
          </div>

          {/* Upload new version */}
          <label className="flex items-center justify-center gap-2 py-5 border-2 border-dashed border-nicara-light rounded-xl cursor-pointer hover:border-nicara-gold transition-colors">
            <span className="text-xl">📐</span>
            <div>
              <div className="text-xs font-bold text-nicara-dark">
                Upload New Version
              </div>
              <div className="text-[10px] text-stone-400">
                PDF, DWG, or Image
              </div>
            </div>
            <input type="file" className="hidden" />
          </label>

          {/* AutoCAD link */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5">
            <span className="text-lg">🏗</span>
            <div className="flex-1">
              <div className="text-xs font-bold text-blue-800">
                AutoCAD Integration
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">
                Open drawing in AutoCAD Web App
              </div>
            </div>
            <button className="px-3 py-1.5 bg-blue-800 border-none rounded-lg text-[11px] text-white cursor-pointer font-semibold hover:bg-blue-900 transition-colors">
              Open AutoCAD →
            </button>
          </div>
        </div>
      )}

      {/* References */}
      {sub === "refs" && (
        <div>
          <SectionHeader title="Client Reference Images" />
          <RefImages
            label="Layout References"
            images={[
              { id: 1, name: "Living Room Ref" },
              { id: 2, name: "Kitchen Layout" },
            ]}
          />
        </div>
      )}

      {/* Approval */}
      {sub === "approval" && (
        <div>
          <SectionHeader title="Client Approval Status" />
          {latestPending ? (
            <ApprovalWidget
              stage={latestPending.label}
              status={null}
              onApprove={(c) => approve(latestPending.id, c)}
              onDeny={(c) => deny(latestPending.id, c)}
              phone="9810011111"
            />
          ) : (
            <Card>
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✅</div>
                <div className="text-sm font-bold text-nicara-dark">
                  All versions have been reviewed
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  No pending approvals
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
