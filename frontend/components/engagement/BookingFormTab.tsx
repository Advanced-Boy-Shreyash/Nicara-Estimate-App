"use client";

import { useState } from "react";
import { ApiError, bookingApi } from "@/lib/api";
import type { BookingForm, Project, ProjectMeta } from "@/lib/apiTypes";
import { useApiData, inrExact } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { Btn, Check, Field, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";

/**
 * Initial Engagement → Booking Form.
 *
 * A project has at most one. Creating it pulls the agreed value from the
 * approved initial estimate; after that it tracks the advance and signature.
 */
export default function BookingFormTab({
  project, meta,
}: {
  project: Project;
  meta: ProjectMeta | null;
}) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [banner, setBanner] = useState("");

  const { data, loading, error, reload, setData } = useApiData(
    async () => {
      try {
        return await bookingApi.get(project.id);
      } catch (e) {
        // 404 simply means "not created yet" — a normal state, not a failure.
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    [project.id]
  );

  const approvedInitial = project.estimates_summary.find(
    e => e.type === "initial" && e.status === "approved"
  );

  const create = async () => {
    setCreating(true);
    setBanner("");
    try {
      const created = await bookingApi.create(project.id, {
        scope_summary: `Interior work for ${project.name}`,
      });
      setData(created);
      toast.success("Booking created", created.booking_number);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Could not create the booking form.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (!data) {
    return (
      <div>
        {banner && <InlineError message={banner} />}
        <EmptyState
          icon="📝"
          title="No booking form yet"
          hint={approvedInitial
            ? `The approved initial estimate (${inrExact(String(approvedInitial.total))}) will be carried over as the agreed value.`
            : "You can create it now, or approve the initial estimate first so the value is filled in automatically."}
          action={<Btn onClick={create} disabled={creating}>{creating ? "Creating…" : "Create Booking Form"}</Btn>}
        />
      </div>
    );
  }

  return <BookingEditor booking={data} project={project} meta={meta} onSaved={setData} />;
}

function BookingEditor({
  booking, project, meta, onSaved,
}: {
  booking: BookingForm;
  project: Project;
  meta: ProjectMeta | null;
  onSaved: (b: BookingForm) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<BookingForm>>({ ...booking });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));
  const err = (field: string) => errors[field]?.[0];

  const save = async (extra: Partial<BookingForm> = {}, message = "Booking form saved") => {
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      const updated = await bookingApi.update(project.id, {
        booking_date: form.booking_date,
        total_value: form.total_value,
        advance_amount: form.advance_amount,
        advance_received: form.advance_received,
        advance_received_on: form.advance_received_on || null,
        payment_mode: form.payment_mode,
        payment_reference: form.payment_reference,
        payment_link: form.payment_link,
        scope_summary: form.scope_summary,
        terms: form.terms,
        notes: form.notes,
        terms_accepted: form.terms_accepted,
        signed_by_name: form.signed_by_name,
        ...extra,
      });
      setForm({ ...updated });
      onSaved(updated);
      toast.success("Saved", message);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        setBanner(e.message);
      } else {
        setBanner("Could not save the booking form.");
      }
    } finally {
      setSaving(false);
    }
  };

  const signed = booking.status === "signed";

  return (
    <div>
      {banner && <InlineError message={banner} />}

      {/* Header strip */}
      <div className="bg-nicara-dark rounded-2xl px-5 py-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] text-surface-500 uppercase tracking-[0.2em]">Booking Number</div>
          <div className="text-[18px] font-extrabold text-nicara-gold">{booking.booking_number}</div>
        </div>
        <div className="flex items-center gap-6">
          <Stat label="Agreed Value" value={inrExact(booking.total_value)} />
          <Stat label="Advance" value={inrExact(booking.advance_amount)}
            note={booking.advance_received ? "received" : "pending"} />
          <Stat label="Balance Due" value={inrExact(booking.balance_due)} gold />
          <StatusPill status={booking.status} label={booking.status_display} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Client & Project">
          <ReadRow label="Client" value={booking.client_name} />
          <ReadRow label="Phone" value={booking.client_phone || "—"} />
          <ReadRow label="Email" value={booking.client_email || "—"} />
          <ReadRow label="Project" value={booking.project_name} />
          <ReadRow label="Developer" value={booking.developer || "—"} />
          <ReadRow label="Unit" value={booking.unit_no || "—"} />
        </Panel>

        <Panel title="Booking">
          <Field label="Booking Date" type="date" value={form.booking_date ?? ""}
            onChange={v => set("booking_date", v)} />
          <Field label="Agreed Value (₹)" type="number" value={form.total_value ?? "0"}
            onChange={v => set("total_value", v)} error={err("total_value")}
            hint={booking.estimate ? "Carried from the approved initial estimate" : undefined} />
          <TextArea label="Scope Summary" value={form.scope_summary ?? ""}
            onChange={v => set("scope_summary", v)} rows={2} />
        </Panel>

        <Panel title="Booking Advance">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Advance (₹)" type="number" value={form.advance_amount ?? "0"}
              onChange={v => set("advance_amount", v)} error={err("advance_amount")} />
            <Select label="Payment Mode" value={form.payment_mode ?? ""} onChange={v => set("payment_mode", v)}
              options={meta?.payment_modes ?? []} placeholder="Select…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Received On" type="date" value={form.advance_received_on ?? ""}
              onChange={v => set("advance_received_on", v)} />
            <Field label="Reference" value={form.payment_reference ?? ""}
              onChange={v => set("payment_reference", v)} placeholder="NEFT-2026-0615-001" />
          </div>
          <Field label="Payment Link" value={form.payment_link ?? ""} onChange={v => set("payment_link", v)}
            placeholder="https://…" error={err("payment_link")} />
          <Check label="Advance received" checked={form.advance_received ?? false}
            onChange={v => set("advance_received", v)} />
        </Panel>

        <Panel title="Sign-off">
          <Field label="Signed By" value={form.signed_by_name ?? ""} onChange={v => set("signed_by_name", v)}
            placeholder="Client name" disabled={signed} />
          <Check label="Terms accepted by client" checked={form.terms_accepted ?? false}
            onChange={v => set("terms_accepted", v)} />
          <TextArea label="Terms" value={form.terms ?? ""} onChange={v => set("terms", v)} rows={3}
            placeholder="Payment schedule, timeline, scope exclusions…" />
          {signed && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              Signed{booking.signed_at ? ` on ${new Date(booking.signed_at).toLocaleString("en-IN")}` : ""}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex items-center gap-2 mt-5 flex-wrap">
        <Btn onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save Booking Form"}</Btn>
        {booking.status === "draft" && (
          <Btn variant="ghost" disabled={saving}
            onClick={() => save({ status: "sent" }, "Marked as sent to client")}>
            📤 Send to Client
          </Btn>
        )}
        {!signed && (
          <Btn variant="ghost" disabled={saving || !form.signed_by_name?.trim()}
            onClick={() => save({ status: "signed", terms_accepted: true }, "Booking signed")}>
            ✍️ Mark Signed
          </Btn>
        )}
        {!signed && !form.signed_by_name?.trim() && (
          <span className="text-[11px] text-surface-400">Enter who signed to enable sign-off</span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, note, gold }: { label: string; value: string; note?: string; gold?: boolean }) {
  return (
    <div>
      <div className="text-[9px] text-surface-500 uppercase tracking-[0.15em]">{label}</div>
      <div className={`text-[14px] font-bold ${gold ? "text-nicara-gold" : "text-white"}`}>{value}</div>
      {note && <div className="text-[9px] text-surface-500 capitalize">{note}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-5">
      <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-3 pb-1.5 border-b border-surface-100">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-surface-50 last:border-0">
      <span className="text-[11px] text-surface-400">{label}</span>
      <span className="text-[12px] font-medium text-nicara-dark text-right">{value}</span>
    </div>
  );
}
