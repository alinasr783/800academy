"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NotifType = {
  id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
};

export default function NotificationTypesPage() {
  const [items, setItems] = useState<NotifType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotifType | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("campaign");
  const [formColor, setFormColor] = useState("#3e5e95");
  const [saving, setSaving] = useState(false);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function adminFetch(path: string, init?: RequestInit) {
    const token = await getToken();
    const res = await fetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const json = await adminFetch("/api/admin/notification-types");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormIcon("campaign");
    setFormColor("#3e5e95");
    setError(null);
    setModalOpen(true);
  }

  function openEdit(item: NotifType) {
    setEditing(item);
    setFormName(item.name);
    setFormIcon(item.icon);
    setFormColor(item.color);
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await adminFetch("/api/admin/notification-types", {
          method: "POST",
          body: JSON.stringify({ action: "update", id: editing.id, name: formName, icon: formIcon, color: formColor }),
        });
      } else {
        await adminFetch("/api/admin/notification-types", {
          method: "POST",
          body: JSON.stringify({ action: "create", name: formName, icon: formIcon, color: formColor }),
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this notification type?")) return;
    try {
      await adminFetch("/api/admin/notification-types", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete.");
    }
  }

  const presetIcons = ["campaign", "auto_awesome", "local_offer", "alarm", "system_update", "celebration", "info", "warning", "new_releases", "star"];

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden rounded-2xl">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">Settings</div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">Notification Types</h1>
            <p className="text-on-surface-variant font-medium mt-3">Manage categories for your notifications.</p>
          </div>
          <button onClick={openCreate} className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors rounded-xl whitespace-nowrap">
            + Add Type
          </button>
        </div>
      </div>

      {error && !modalOpen ? <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700 font-medium">{error}</div> : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">Preview</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Icon</th>
                <th className="px-6 py-4">Color</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-on-surface-variant">No notification types yet.</td></tr>
              ) : items.map((it) => (
                <tr key={it.id} className="border-t border-outline/40 hover:bg-surface-variant/30 transition-colors">
                  <td className="px-6 py-5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: it.color + "20" }}>
                      <span className="material-symbols-outlined text-[20px]" style={{ color: it.color, fontVariationSettings: "'FILL' 1" }}>{it.icon}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-primary">{it.name}</td>
                  <td className="px-6 py-5 font-mono text-sm text-on-surface-variant">{it.icon}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border border-outline/40" style={{ backgroundColor: it.color }} />
                      <span className="font-mono text-sm text-on-surface-variant">{it.color}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(it)} className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-variant rounded-lg transition-colors">Edit</button>
                      <button onClick={() => handleDelete(it.id)} className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button onClick={() => setModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white border border-outline/60 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between bg-surface-variant/30">
              <div className="text-lg font-extrabold text-primary font-headline">{editing ? "Edit Type" : "New Type"}</div>
              <button onClick={() => setModalOpen(false)} className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Close</button>
            </div>
            {error && <div className="p-4 border-b border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">{error}</div>}
            <div className="p-6 space-y-5">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Name</div>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Special Offer" className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors" />
              </div>
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Icon (Material Symbol)</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {presetIcons.map((ic) => (
                    <button key={ic} type="button" onClick={() => setFormIcon(ic)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${formIcon === ic ? "border-primary bg-primary/10" : "border-outline/40 hover:border-primary/40"}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ color: formColor, fontVariationSettings: "'FILL' 1" }}>{ic}</span>
                    </button>
                  ))}
                </div>
                <input value={formIcon} onChange={(e) => setFormIcon(e.target.value)} placeholder="campaign" className="h-10 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors text-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Color</div>
                <div className="flex items-center gap-3">
                  <input type="color" value={formColor} onChange={(e) => setFormColor(e.target.value)} className="w-12 h-10 rounded-lg border border-outline/40 cursor-pointer" />
                  <input value={formColor} onChange={(e) => setFormColor(e.target.value)} className="h-10 flex-1 px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors text-sm font-mono" />
                </div>
              </div>
              {/* Preview */}
              <div className="flex items-center gap-3 p-4 bg-surface-variant/50 rounded-xl border border-outline/30">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: formColor + "20" }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color: formColor, fontVariationSettings: "'FILL' 1" }}>{formIcon}</span>
                </div>
                <span className="font-bold text-primary">{formName || "Preview"}</span>
              </div>

              <button onClick={handleSave} disabled={saving || !formName.trim()} className="h-14 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60 rounded-xl mt-2">
                {saving ? "Saving…" : editing ? "Update Type" : "Create Type"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
