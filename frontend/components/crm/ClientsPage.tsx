"use client";

import { useState } from "react";
import { ApiError, clientsApi, crmApi } from "@/lib/api";
import type { Client, CrmMeta } from "@/lib/apiTypes";
import { useApiData } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import { Btn, Check, Field, FormSection, Select, TextArea } from "@/components/ui/Form";
import { EmptyState, ErrorState, InlineError, Loading, StatusPill } from "@/components/ui/States";

/** Customers → Clients. Everyone you have done business with. */
export default function ClientsPage({ onOpenProject }: { onOpenProject?: (id: number) => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | "new" | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);

  const { data, loading, error, reload } = useApiData(() => clientsApi.list(search), [search]);
  const { data: meta } = useApiData<CrmMeta>(() => crmApi.meta(), []);

  const clients = data?.results ?? [];

  return (
    <div className="p-6 px-8 animate-fade-in">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-bold text-nicara-dark m-0">Clients</h1>
          <p className="text-[12px] text-surface-500 mt-1 m-0">
            Customer records with their billing details and linked projects.
          </p>
        </div>
        <button onClick={() => setEditing("new")}
          className="px-4 py-2.5 btn-gold rounded-xl text-[12px] font-bold border-none cursor-pointer">
          + Add Client
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-[340px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-surface-400">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company, phone, GST…"
            className="w-full pl-9 pr-3 py-2.5 border border-surface-200 rounded-xl text-[12px] bg-white outline-none focus:border-nicara-gold" />
        </div>
        <span className="text-[11px] text-surface-400">{clients.length} client(s)</span>
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && clients.length === 0 && (
        <EmptyState icon="👤" title={search ? "No matches" : "No clients yet"}
          hint={search ? "Try a different search." : "Clients appear here when a lead is converted, or add one directly."} />
      )}

      {!loading && !error && clients.length > 0 && (
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-nicara-dark">
                  {["Code", "Name", "Type", "Contact", "City", "GST", "Projects", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2.5 text-surface-300 font-semibold text-left text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id}
                    className={`border-b border-surface-100 hover:bg-surface-50 ${!client.is_active ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-400 whitespace-nowrap">{client.code}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-nicara-dark">{client.name}</div>
                      {client.company_name && (
                        <div className="text-[10px] text-surface-400">{client.company_name}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{client.type_display}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-surface-600">{client.phone || "—"}</div>
                      <div className="text-[10px] text-surface-400">{client.email}</div>
                    </td>
                    <td className="px-3 py-2.5 text-surface-600">{client.city || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-surface-500">{client.gst_number || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-bold text-nicara-dark">{client.project_count}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={client.is_active ? "approved" : "cancelled"}
                        label={client.is_active ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setViewing(client)}
                        className="px-2.5 py-1 bg-surface-100 rounded-lg text-[11px] cursor-pointer border-none text-surface-600 hover:bg-surface-200 mr-1.5">
                        View
                      </button>
                      <button onClick={() => setEditing(client)}
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
        <ClientModal client={editing === "new" ? null : editing} meta={meta}
          onClose={() => setEditing(null)}
          onSaved={msg => { setEditing(null); toast.success("Saved", msg); void reload(); }} />
      )}

      {viewing && (
        <ClientDetailModal clientId={viewing.id} onClose={() => setViewing(null)}
          onOpenProject={id => { setViewing(null); onOpenProject?.(id); }} />
      )}
    </div>
  );
}

function ClientModal({
  client, meta, onClose, onSaved,
}: {
  client: Client | null;
  meta: CrmMeta | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>(
    client ? { ...client } : {
      name: "", client_type: "individual", company_name: "", email: "", phone: "",
      address: "", city: "", state: "", pincode: "", gst_number: "", pan_number: "",
      notes: "", is_active: true,
    }
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm(f => ({ ...f, [k]: v }));
  const err = (field: string) => errors[field]?.[0];

  const save = async () => {
    if (!form.name?.trim()) { setErrors({ name: ["Name is required."] }); return; }
    setSaving(true);
    setBanner("");
    setErrors({});
    try {
      if (client) {
        await clientsApi.update(client.id, form);
        onSaved(`${form.name} updated`);
      } else {
        await clientsApi.create(form);
        onSaved(`${form.name} added`);
      }
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.errors); setBanner(e.message); }
      else setBanner("Could not save the client.");
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={client ? `Edit ${client.name}` : "New Client"}
      subtitle={client ? client.code : "Fields marked * are required"}
      footer={<>
        <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn>
      </>}>
      {banner && <InlineError message={banner} />}

      <FormSection title="Identity">
        <Field label="Name" value={form.name ?? ""} onChange={v => set("name", v)} required error={err("name")} />
        <Select label="Type" value={form.client_type ?? "individual"} onChange={v => set("client_type", v)}
          options={meta?.client_types ?? []} />
        <div className="col-span-2">
          <Field label="Company Name" value={form.company_name ?? ""} onChange={v => set("company_name", v)} />
        </div>
      </FormSection>

      <FormSection title="Contact">
        <Field label="Phone" value={form.phone ?? ""} onChange={v => set("phone", v)} />
        <Field label="Alt Phone" value={form.alt_phone ?? ""} onChange={v => set("alt_phone", v)} />
        <div className="col-span-2">
          <Field label="Email" type="email" value={form.email ?? ""} onChange={v => set("email", v)} error={err("email")} />
        </div>
        <div className="col-span-2">
          <TextArea label="Address" value={form.address ?? ""} onChange={v => set("address", v)} rows={2} />
        </div>
        <Field label="City" value={form.city ?? ""} onChange={v => set("city", v)} />
        <Field label="State" value={form.state ?? ""} onChange={v => set("state", v)} />
        <Field label="Pincode" value={form.pincode ?? ""} onChange={v => set("pincode", v)} />
      </FormSection>

      <FormSection title="Billing">
        <Field label="GSTIN" value={form.gst_number ?? ""} onChange={v => set("gst_number", v.toUpperCase())}
          error={err("gst_number")} hint="15 characters" />
        <Field label="PAN" value={form.pan_number ?? ""} onChange={v => set("pan_number", v.toUpperCase())}
          error={err("pan_number")} hint="10 characters" />
        <div className="col-span-2">
          <TextArea label="Notes" value={form.notes ?? ""} onChange={v => set("notes", v)} rows={2} />
        </div>
        <Check label="Active" checked={form.is_active ?? true} onChange={v => set("is_active", v)} />
      </FormSection>
    </Modal>
  );
}

function ClientDetailModal({
  clientId, onClose, onOpenProject,
}: {
  clientId: number;
  onClose: () => void;
  onOpenProject: (id: number) => void;
}) {
  const { data, loading, error, reload } = useApiData(() => clientsApi.get(clientId), [clientId]);

  return (
    <Modal open onClose={onClose} size="md" title={data?.name ?? "Client"}
      subtitle={data?.code}
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 text-[12px] mb-5">
            {([
              ["Type", data.type_display],
              ["Company", data.company_name || "—"],
              ["Phone", data.phone || "—"],
              ["Email", data.email || "—"],
              ["City", data.city || "—"],
              ["GSTIN", data.gst_number || "—"],
            ] as const).map(([label, value]) => (
              <div key={label} className="bg-surface-50 rounded-xl px-3 py-2">
                <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">{label}</div>
                <div className="text-nicara-dark mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-[0.12em] mb-2">
            Projects ({data.project_count})
          </div>
          {(data.projects ?? []).length === 0 ? (
            <div className="text-[12px] text-surface-400 py-3">No projects linked yet.</div>
          ) : (
            <div className="space-y-2">
              {data.projects!.map(project => (
                <button key={project.id} onClick={() => onOpenProject(project.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-surface-200 rounded-xl cursor-pointer hover:border-nicara-gold text-left">
                  <div>
                    <div className="text-[12px] font-semibold text-nicara-dark">{project.name}</div>
                    <div className="text-[10px] text-surface-400 capitalize">{project.stage} · {project.progress}%</div>
                  </div>
                  <span className="text-[11px] text-nicara-gold font-semibold">Open →</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
