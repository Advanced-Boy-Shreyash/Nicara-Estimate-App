"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (data: { name: string; email: string; role: string; message: string }) => void;
}

export default function InviteUserModal({ open, onClose, onInvite }: InviteUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("designer");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = () => {
    if (!name || !email) return;
    setSending(true);
    // Simulate API call — POST /api/auth/invite/
    setTimeout(() => {
      onInvite({ name, email, role, message });
      setName(""); setEmail(""); setRole("designer"); setMessage("");
      setSending(false);
      onClose();
    }, 1000);
  };

  const inputCls = "w-full px-3.5 py-2.5 border border-surface-300 rounded-xl text-[13px] bg-white text-nicara-dark";

  return (
    <Modal open={open} onClose={onClose} title="Invite New User" subtitle="Send an invitation email to join NICARA Project OS" size="md"
      footer={
        <>
          <button onClick={onClose} className="px-5 py-2.5 bg-transparent border border-surface-300 rounded-xl text-[13px] text-surface-500 cursor-pointer hover:bg-surface-100">Cancel</button>
          <button onClick={handleSubmit} disabled={!name || !email || sending}
            className={`px-6 py-2.5 rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2 ${
              !name || !email || sending ? "bg-surface-200 text-surface-400 cursor-not-allowed" : "btn-gold"
            }`}>
            {sending ? <><span className="animate-spin-slow inline-block">⟳</span> Sending…</> : <>📧 Send Invitation</>}
          </button>
        </>
      }>

      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Full Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className={inputCls} />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@company.com" className={inputCls} />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className={inputCls + " cursor-pointer"}>
            <option value="admin">Admin — Full access to all features</option>
            <option value="designer">Designer — Design + estimates access</option>
            <option value="client">Client — View-only project access</option>
            <option value="supervisor">Site Supervisor — PM + handover access</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-1.5">Personal Message (Optional)</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Welcome to our team! You'll be working on..."
            className={inputCls + " resize-none"} />
        </div>

        <div className="bg-nicara-gold-light border border-nicara-gold/15 rounded-xl p-3.5">
          <div className="text-[10px] text-nicara-gold font-bold uppercase tracking-wider mb-1">What happens next?</div>
          <ul className="text-[11px] text-surface-600 space-y-1 list-none pl-0 m-0">
            <li>📧 An invitation email is sent to the user</li>
            <li>🔗 User clicks the invitation link to set their password</li>
            <li>✅ Once registered, they can access pages based on their role</li>
            <li>🔐 You can further customize permissions in the IAM page</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
