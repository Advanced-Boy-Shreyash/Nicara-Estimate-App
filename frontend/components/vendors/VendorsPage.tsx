"use client";

import { useState } from "react";
import { ApiError, vendorsApi, type VendorInput } from "@/lib/api";
import type { Vendor, VendorMeta } from "@/lib/apiTypes";
import { useApiData, inr } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, FormSection, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui/States";

type Kind = "supplier" | "contractor";

const BLANK: VendorInput = {
  name: "", contact_person: "", phone: "", email: "", city: "", state: "",
  address: "", gst_number: "", pan_number: "", bank_name: "", bank_account_name: "",
  bank_account_number: "", bank_ifsc: "", upi_id: "", payment_terms: "on_delivery",
  credit_days: 0, brands_supplied: "", lead_time_days: 0, min_order_value: "0",
  trade: "", specialization: "", team_size: 0, labour_rate_per_day: "0",
  rating: "0", is_preferred: false, is_active: true, notes: "",
};

export default function VendorsPage({ kind }: { kind: Kind }) {
  const isSupplier = kind === "supplier";
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);

  const { data, loading, error, reload } = useApiData(
    () => (isSupplier ? vendorsApi.suppliers(search) : vendorsApi.contractors(search)),
    [kind, search]
  );
  const { data: meta } = useApiData<VendorMeta>(() => vendorsApi.meta(), []);

  const vendors = data?.results ?? [];
  const title = isSupplier ? "Material Suppliers" : "Contractors";

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">{title}</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            {isSupplier
              ? "Vendors you buy material from — brands, lead times and payment terms."
              : "Trade partners who execute work on site — rates, team size and terms."}
          </p>
        </div>
        <button onClick={() => setEditing("new")}
          className="px-4 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">
          + Add {isSupplier ? "Supplier" : "Contractor"}
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[360px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isSupplier ? "Search name, brand, city…" : "Search name, trade, city…"}
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold"
          />
        </div>
        <span className="text-[11px] text-surface-400">{vendors.length} record(s)</span>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && vendors.length === 0 && (
        <EmptyState
          icon={isSupplier ? "🏭" : "👷"}
          title={search ? "No matches" : `No ${title.toLowerCase()} yet`}
          hint={search ? "Try a different search term." : "Add your first one to get started."}
        />
      )}

      {!loading && !error && vendors.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Code", "Name", "Contact", "City",
                    isSupplier ? "Brands" : "Trade",
                    isSupplier ? "Lead Time" : "Team",
                    "Payment Terms", "GST", "Rating", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id} className={`border-b border-surface-100 hover:bg-surface-50 ${!v.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-400 whitespace-nowrap">{v.code}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark flex items-center gap-1.5">
                        {v.name}
                        {v.is_preferred && <span title="Preferred vendor" className="text-[11px]">⭐</span>}
                      </div>
                      {v.email && <div className="text-[10px] text-surface-400">{v.email}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-surface-600">{v.contact_person || "—"}</div>
                      <div className="text-[10px] text-surface-400">{v.phone}</div>
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{v.city || "—"}</td>
                    <td className="px-3 py-2.5 text-surface-600 max-w-[220px]">
                      {isSupplier
                        ? (v.brands_supplied || "—")
                        : (v.trade_display ? <StatusPill status="design" label={v.trade_display} /> : "—")}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap">
                      {isSupplier
                        ? (v.lead_time_days ? `${v.lead_time_days} days` : "—")
                        : (v.team_size ? `${v.team_size} people` : "—")}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600 whitespace-nowrap">
                      {v.payment_terms_display}
                      {v.credit_days > 0 && <span className="text-surface-400"> · {v.credit_days}d</span>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-500">{v.gst_number || "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {parseFloat(v.rating) > 0
                        ? <span className="text-nicara-gold font-bold">★ {v.rating}</span>
                        : <span className="text-surface-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => setEditing(v)}
                        className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <VendorModal
          kind={kind}
          vendor={editing === "new" ? null : editing}
          meta={meta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success(msg); void reload(); }}
        />
      )}
    </div>
  );
}

/* ── Add / edit modal ─────────────────────────────────────────── */

function VendorModal({
  kind, vendor, meta, onClose, onSaved,
}: {
  kind: Kind;
  vendor: Vendor | null;
  meta: VendorMeta | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isSupplier = kind === "supplier";
  const [form, setForm] = useState<VendorInput>(
    vendor ? { ...vendor } : { ...BLANK, trade: isSupplier ? "" : "carpentry" }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof VendorInput>(key: K, value: VendorInput[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const err = (field: string) => errors[field]?.[0];

  const save = async () => {
    if (!form.name?.trim()) {
      setErrors({ name: ["Name is required."] });
      return;
    }
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      if (vendor) {
        await vendorsApi.update(vendor.id, form);
        onSaved(`${form.name} updated`);
      } else if (isSupplier) {
        await vendorsApi.createSupplier(form);
        onSaved(`${form.name} added`);
      } else {
        await vendorsApi.createContractor(form);
        onSaved(`${form.name} added`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors);
        setBanner(e.message);
      } else {
        setBanner("Could not save. Is the backend running?");
      }
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!vendor) return;
    setSaving(true);
    try {
      await vendorsApi.delete(vendor.id);
      onSaved(`${vendor.name} deactivated`);
    } catch {
      setBanner("Could not deactivate.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={vendor ? `Edit ${vendor.name}` : `New ${isSupplier ? "Material Supplier" : "Contractor"}`}
      subtitle={vendor ? vendor.code : "Fields marked * are required"}
      footer={
        <>
          {vendor && vendor.is_active && (
            <Btn variant="danger" onClick={deactivate} disabled={saving}>Deactivate</Btn>
          )}
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
        </>
      }
    >
      {banner && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[12px] text-red-700 font-medium">
          {banner}
        </div>
      )}

      <FormSection title="Identity">
        <Field label="Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} />
        <Field label="Legal / Registered Name" value={form.legal_name ?? ""} onChange={v => set("legal_name", v)} />
      </FormSection>

      <FormSection title="Contact">
        <Field label="Contact Person" value={form.contact_person ?? ""} onChange={v => set("contact_person", v)} />
        <Field label="Phone" value={form.phone ?? ""} onChange={v => set("phone", v)} error={err("phone")} />
        <Field label="Email" type="email" value={form.email ?? ""} onChange={v => set("email", v)} error={err("email")} />
        <Field label="Website" value={form.website ?? ""} onChange={v => set("website", v)} error={err("website")} />
      </FormSection>

      <FormSection title="Address">
        <div className="col-span-2">
          <Field label="Address" value={form.address ?? ""} onChange={v => set("address", v)} />
        </div>
        <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
        <Field label="State" value={form.state ?? ""} onChange={v => set("state", v)} />
        <Field label="Pincode" value={form.pincode ?? ""} onChange={v => set("pincode", v)} />
      </FormSection>

      <FormSection title="Statutory & Banking">
        <Field label="GSTIN" value={form.gst_number ?? ""} onChange={v => set("gst_number", v.toUpperCase())}
          error={err("gst_number")} hint="15 characters" />
        <Field label="PAN" value={form.pan_number ?? ""} onChange={v => set("pan_number", v.toUpperCase())}
          error={err("pan_number")} hint="10 characters" />
        <Field label="Bank Name" value={form.bank_name ?? ""} onChange={v => set("bank_name", v)} />
        <Field label="Account Holder" value={form.bank_account_name ?? ""} onChange={v => set("bank_account_name", v)} />
        <Field label="Account Number" value={form.bank_account_number ?? ""} onChange={v => set("bank_account_number", v)} />
        <Field label="IFSC" value={form.bank_ifsc ?? ""} onChange={v => set("bank_ifsc", v.toUpperCase())} />
        <Field label="UPI ID" value={form.upi_id ?? ""} onChange={v => set("upi_id", v)} />
      </FormSection>

      <FormSection title="Commercial Terms">
        <Select label="Payment Terms" value={form.payment_terms ?? "on_delivery"}
          onChange={v => set("payment_terms", v)}
          options={meta?.payment_terms ?? []} />
        <Field label="Credit Days" type="number" value={form.credit_days ?? 0}
          onChange={v => set("credit_days", Number(v) || 0)} />
        <Field label="Advance %" type="number" value={form.advance_pct ?? "0"}
          onChange={v => set("advance_pct", v)} />
      </FormSection>

      {isSupplier ? (
        <FormSection title="Supplier Details">
          <div className="col-span-2">
            <Field label="Brands Supplied" value={form.brands_supplied ?? ""}
              onChange={v => set("brands_supplied", v)}
              hint="Comma separated, e.g. Austin, Greenlam, Hettich" />
          </div>
          <Field label="Lead Time (days)" type="number" value={form.lead_time_days ?? 0}
            onChange={v => set("lead_time_days", Number(v) || 0)} />
          <Field label="Minimum Order Value" type="number" value={form.min_order_value ?? "0"}
            onChange={v => set("min_order_value", v)} />
          <Check label="Delivers on site" checked={form.delivers_on_site ?? true}
            onChange={v => set("delivers_on_site", v)} />
        </FormSection>
      ) : (
        <FormSection title="Contractor Details">
          <Select label="Trade" value={form.trade ?? ""} onChange={v => set("trade", v)}
            options={meta?.trades ?? []} required error={err("trade")} />
          <Field label="Team Size" type="number" value={form.team_size ?? 0}
            onChange={v => set("team_size", Number(v) || 0)} />
          <Field label="Labour Rate / Day" type="number" value={form.labour_rate_per_day ?? "0"}
            onChange={v => set("labour_rate_per_day", v)} />
          <div className="col-span-2">
            <Field label="Specialization" value={form.specialization ?? ""}
              onChange={v => set("specialization", v)} />
          </div>
        </FormSection>
      )}

      <FormSection title="Status">
        <Field label="Rating (0–5)" type="number" value={form.rating ?? "0"}
          onChange={v => set("rating", v)} error={err("rating")} />
        <div className="flex items-end gap-5 pb-1">
          <Check label="Preferred" checked={form.is_preferred ?? false} onChange={v => set("is_preferred", v)} />
          <Check label="Active" checked={form.is_active ?? true} onChange={v => set("is_active", v)} />
        </div>
        <div className="col-span-2">
          <TextArea label="Notes" value={form.notes ?? ""} onChange={v => set("notes", v)} rows={2} />
        </div>
      </FormSection>

      {isSupplier && form.min_order_value && parseFloat(String(form.min_order_value)) > 0 && (
        <div className="text-[11px] text-surface-400">
          Minimum order: {inr(form.min_order_value)}
        </div>
      )}
    </Modal>
  );
}
