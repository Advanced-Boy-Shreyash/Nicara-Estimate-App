"use client";

import { useState } from "react";
import { catalogApi } from "@/lib/api";
import type { Furniture } from "@/lib/apiTypes";
import Modal from "@/components/ui/Modal";
import { Btn, Field } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";

export function AddFurnitureModal({
  open,
  onClose,
  initialName,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  onSuccess: (furniture: Furniture) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await catalogApi.createFurniture({
        name: name.trim(),
        description: description.trim(),
      });
      toast.success("Success", "Furniture item created in Catalogue");
      onSuccess(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Item to Catalogue"
      footer={
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Item"}
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <div className="p-3 text-[12px] bg-red-50 text-red-600 rounded-lg">{error}</div>}
        <Field
          label="Item Name"
          value={name}
          onChange={setName}
          required
        />
        <Field
          label="Description (Optional)"
          value={description}
          onChange={setDescription}
        />
        <div className="text-[11px] text-surface-500 italic mt-2">
          This item will be saved to the master Catalogue and will be available across all projects.
        </div>
      </div>
    </Modal>
  );
}
