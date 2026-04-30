"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NotifType = { id: string; name: string; icon: string; color: string };
type Notification = {
  id: string;
  type_id: string | null;
  title: string;
  body: string;
  image_url: string | null;
  target_user_id: string | null;
  actions: { label: string; href: string }[];
  is_active: boolean;
  created_at: string;
  notification_types: { name: string; icon: string; color: string } | null;
};
type UserLite = { id: string; email: string | null; full_name: string | null };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [types, setTypes] = useState<NotifType[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notification | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formTypeId, setFormTypeId] = useState("");
  const [formTarget, setFormTarget] = useState<"all" | "user">("all");
  const [formTargetUserId, setFormTargetUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [userChoices, setUserChoices] = useState<UserLite[]>([]);
  const [formActions, setFormActions] = useState<{ label: string; href: string }[]>([]);
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
      const [notifsJson, typesJson] = await Promise.all([
        adminFetch("/api/admin/notifications?limit=100"),
        adminFetch("/api/admin/notification-types"),
      ]);
      setItems(notifsJson.items ?? []);
      setCount(notifsJson.count ?? 0);
      setTypes(typesJson.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // User search debounce
  useEffect(() => {
    if (formTarget !== "user" || !userSearch.trim()) {
      setUserChoices([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const json = await adminFetch(`/api/admin/users?q=${encodeURIComponent(userSearch.trim())}&limit=8`);
        setUserChoices(json.items ?? []);
      } catch { setUserChoices([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, formTarget]);

  function openCreate() {
    setEditing(null);
    setFormTitle("");
    setFormBody("");
    setFormTypeId(types.length > 0 ? types[0].id : "");
    setFormTarget("all");
    setFormTargetUserId(null);
    setUserSearch("");
    setFormActions([]);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(n: Notification) {
    setEditing(n);
    setFormTitle(n.title);
    setFormBody(n.body);
    setFormTypeId(n.type_id ?? "");
    setFormTarget(n.target_user_id ? "user" : "all");
    setFormTargetUserId(n.target_user_id);
    setUserSearch(n.target_user_id ?? "");
    setFormActions(Array.isArray(n.actions) ? n.actions : []);
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        title: formTitle,
        body: formBody,
        type_id: formTypeId || null,
        target_user_id: formTarget === "user" ? formTargetUserId : null,
        actions: formActions.filter(a => a.label.trim() && a.href.trim()),
      };

      if (editing) {
        await adminFetch("/api/admin/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "update", id: editing.id, ...payload }),
        });
      } else {
        await adminFetch("/api/admin/notifications", {
          method: "POST",
          body: JSON.stringify({ action: "create", ...payload }),
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
    if (!confirm("Delete this notification permanently?")) return;
    try {
      await adminFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete.");
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await adminFetch("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "update", id, is_active: !current }),
      });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update.");
    }
  }

  function addAction() {
    if (formActions.length >= 2) return;
    setFormActions([...formActions, { label: "", href: "" }]);
  }

  function updateAction(idx: number, field: "label" | "href", value: string) {
    const copy = [...formActions];
    copy[idx] = { ...copy[idx], [field]: value };
    setFormActions(copy);
  }

  function removeAction(idx: number) {
    setFormActions(formActions.filter((_, i) => i !== idx));
  }

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden rounded-2xl">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">Communication</div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">Notifications</h1>
            <p className="text-on-surface-variant font-medium mt-3">Total: {count}</p>
          </div>
          <button onClick={openCreate} className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors rounded-xl whitespace-nowrap">
            + Send Notification
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
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Target</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant">No notifications sent yet.</td></tr>
              ) : items.map((n) => (
                <tr key={n.id} className="border-t border-outline/40 hover:bg-surface-variant/30 transition-colors">
                  <td className="px-6 py-5">
                    {n.notification_types ? (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: n.notification_types.color + "20" }}>
                        <span className="material-symbols-outlined text-[18px]" style={{ color: n.notification_types.color, fontVariationSettings: "'FILL' 1" }}>{n.notification_types.icon}</span>
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">notifications</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-primary text-sm">{n.title}</div>
                    {n.body && <div className="text-xs text-on-surface-variant mt-1 line-clamp-1 max-w-[300px]">{n.body}</div>}
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 text-[10px] font-black tracking-[0.15em] uppercase rounded-full ${n.target_user_id ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {n.target_user_id ? "Specific User" : "All Users"}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button onClick={() => toggleActive(n.id, n.is_active)}
                      className={`px-3 py-1 text-[10px] font-black tracking-[0.15em] uppercase rounded-full transition-colors ${n.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {n.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">{new Date(n.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(n)} className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-variant rounded-lg transition-colors">Edit</button>
                      <button onClick={() => handleDelete(n.id)} className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">Delete</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button onClick={() => setModalOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white border border-outline/60 shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between bg-surface-variant/30 flex-shrink-0">
              <div className="text-lg font-extrabold text-primary font-headline">{editing ? "Edit Notification" : "Send Notification"}</div>
              <button onClick={() => setModalOpen(false)} className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors">Close</button>
            </div>
            {error && <div className="p-4 border-b border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium flex-shrink-0">{error}</div>}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Type */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Type</div>
                <select value={formTypeId} onChange={(e) => setFormTypeId(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors">
                  <option value="">— No Type —</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {/* Title */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Title *</div>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Notification title"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors" />
              </div>
              {/* Body */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Body</div>
                <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Notification body text…" rows={3}
                  className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors resize-none" />
              </div>
              {/* Target */}
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Target</div>
                <div className="flex bg-surface-variant p-1 rounded-xl mb-3">
                  <button onClick={() => { setFormTarget("all"); setFormTargetUserId(null); }}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${formTarget === "all" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}>
                    All Users
                  </button>
                  <button onClick={() => setFormTarget("user")}
                    className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${formTarget === "user" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"}`}>
                    Specific User
                  </button>
                </div>
                {formTarget === "user" && (
                  <div className="relative">
                    <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by email or name…"
                      className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none rounded-xl transition-colors" />
                    {userChoices.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 border border-outline/40 bg-white max-h-44 overflow-auto rounded-xl shadow-lg">
                        {userChoices.map((u) => (
                          <button key={u.id} type="button" onClick={() => { setFormTargetUserId(u.id); setUserSearch(u.email ?? u.full_name ?? u.id); setUserChoices([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors border-b border-outline/30 last:border-0">
                            <div className="text-sm font-bold text-primary">{u.full_name || "—"}</div>
                            <div className="text-xs text-on-surface-variant mt-0.5">{u.email || u.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Action Buttons */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest">Buttons (max 2)</div>
                  {formActions.length < 2 && (
                    <button onClick={addAction} className="text-xs font-bold text-secondary hover:text-primary transition-colors">+ Add Button</button>
                  )}
                </div>
                {formActions.map((a, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={a.label} onChange={(e) => updateAction(i, "label", e.target.value)} placeholder="Label (e.g. Explore)"
                      className="h-10 flex-1 px-3 bg-background border border-border/60 focus:border-primary outline-none rounded-lg transition-colors text-sm" />
                    <input value={a.href} onChange={(e) => updateAction(i, "href", e.target.value)} placeholder="URL (e.g. /plans)"
                      className="h-10 flex-1 px-3 bg-background border border-border/60 focus:border-primary outline-none rounded-lg transition-colors text-sm" />
                    <button onClick={() => removeAction(i)} className="h-10 w-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={handleSave} disabled={saving || !formTitle.trim()}
                className="h-14 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60 rounded-xl mt-2">
                {saving ? "Saving…" : editing ? "Update Notification" : "Send Notification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
