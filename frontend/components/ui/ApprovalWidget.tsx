"use client";

import { useState } from "react";
import SendBar from "./SendBar";

interface ApprovalWidgetProps {
  stage: string;
  status: "approved" | "denied" | null;
  onApprove?: (comment: string) => void;
  onDeny?: (comment: string) => void;
  comment?: string;
  onComment?: (c: string) => void;
  phone?: string;
}

export default function ApprovalWidget({
  stage,
  status,
  onApprove,
  onDeny,
  comment,
  phone = "",
}: ApprovalWidgetProps) {
  const [localComment, setLocalComment] = useState(comment || "");

  if (status === "approved")
    return (
      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 px-4 flex items-center gap-2.5 animate-slide-up">
        <span className="text-xl">✅</span>
        <div>
          <div className="text-[13px] font-bold text-emerald-700">
            {stage} Approved
          </div>
          {comment && (
            <div className="text-[11px] text-emerald-800 mt-0.5">{comment}</div>
          )}
        </div>
      </div>
    );

  if (status === "denied")
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 px-4 animate-slide-up">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-xl">❌</span>
          <div className="text-[13px] font-bold text-red-600">
            {stage} Denied — Rework Required
          </div>
        </div>
        {comment && (
          <div className="text-xs text-red-900 p-2 px-3 bg-white rounded-md">
            {comment}
          </div>
        )}
      </div>
    );

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 px-4 animate-fade-in">
      <div className="text-xs font-bold text-amber-800 mb-2.5">
        ⏳ Awaiting Client Approval — {stage}
      </div>
      <textarea
        value={localComment}
        onChange={(e) => setLocalComment(e.target.value)}
        rows={2}
        placeholder="Add comments for client (will be sent with approval request)..."
        className="w-full p-2.5 px-3 border border-nicara-light rounded-lg text-xs resize-y outline-none mb-2.5 focus:border-nicara-gold"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onApprove?.(localComment)}
          className="px-5 py-2 bg-emerald-700 border-none rounded-lg text-white text-xs cursor-pointer font-bold hover:bg-emerald-800 transition-colors"
        >
          ✅ Mark Approved
        </button>
        <button
          onClick={() => onDeny?.(localComment)}
          className="px-5 py-2 bg-red-600 border-none rounded-lg text-white text-xs cursor-pointer font-bold hover:bg-red-700 transition-colors"
        >
          ❌ Mark Denied
        </button>
        <SendBar
          subject={`${stage} — Please Review`}
          body={`Hi,\n\nPlease review the ${stage} and let us know your feedback.\n\n${localComment}`}
          phone={phone}
        />
      </div>
    </div>
  );
}
