"use client";

import Card from "@/components/ui/Card";
import SectionHeader from "@/components/ui/SectionHeader";
import SendBar from "@/components/ui/SendBar";

export default function Handover() {
  return (
    <div className="animate-fade-in">
      <div className="flex justify-end mb-3">
        <SendBar subject="Project Handover — Sharma Residence" body="Please find all handover documents attached." phone="9810011111" />
      </div>

      <SectionHeader title="Handover Stages" />
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          ["Internal QC", "Completed", "28 May"],
          ["Client Walkthrough", "Scheduled", "02 Jun"],
          ["Snag Rectification", "Pending", "—"],
          ["Final Handover", "Pending", "—"],
        ].map(([label, status, date]) => (
          <Card key={label} className="flex justify-between items-center">
            <div>
              <div className="text-xs font-semibold text-nicara-dark">{label}</div>
              <div className="text-[11px] text-stone-400 mt-0.5">{date}</div>
            </div>
            <div className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              status === "Completed" ? "bg-nicara-teal/15 text-nicara-teal"
              : status === "Scheduled" ? "bg-nicara-gold/15 text-nicara-gold"
              : "bg-nicara-light text-stone-400"
            }`}>
              {status}
            </div>
          </Card>
        ))}
      </div>

      <SectionHeader title="Handover Documents" />
      {[
        ["Warranty Document", "All warranties with expiry dates", true],
        ["Vendor Contact List", "All vendor contacts", true],
        ["Care Guide", "Maintenance instructions", false],
        ["As-Built Drawings", "Final drawings", false],
      ].map(([doc, desc, ready]) => (
        <div key={doc as string} className="flex items-center gap-2.5 py-2.5 border-b border-nicara-light">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[13px] shrink-0 ${
            ready ? "bg-nicara-teal/15 text-nicara-teal" : "bg-nicara-light text-stone-400"
          }`}>
            {ready ? "✓" : "○"}
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-nicara-dark">{doc as string}</div>
            <div className="text-[11px] text-stone-400 mt-0.5">{desc as string}</div>
          </div>
          <div className={`text-[11px] ${ready ? "text-nicara-teal" : "text-stone-400"}`}>
            {ready ? "Ready" : "Pending"}
          </div>
        </div>
      ))}

      <div className="mt-4">
        <SectionHeader title="Post Handover" />
        {[
          ["7 Days", "Feedback Request"],
          ["15 Days", "Google Review Request"],
          ["30 Days", "Referral Request"],
        ].map(([t, a]) => (
          <Card key={t} className="mb-2 flex gap-3.5 items-center">
            <div className="min-w-[56px] text-xs font-bold text-nicara-gold">{t}</div>
            <div className="text-xs text-nicara-dark">{a}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
