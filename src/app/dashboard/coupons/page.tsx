"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CouponUsage = {
  id: string;
  coupon_id: string;
  user_id: string;
  discount_applied_cents: number;
  ip_address: string;
  used_at: string;
  coupon: { code: string };
  profile: { email: string; full_name: string };
};

type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_cents: number;
  max_discount_cents: number | null;
  start_at: string;
  expires_at: string | null;
  is_active: boolean;
  is_new_user_only: boolean;
  total_usage_limit: number | null;
  used_count: number;
  subject_id: string | null;
  created_at: string;
};

type Subject = {
  id: string;
  title: string;
};

export default function CouponsDashboard() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [usage, setUsage] = useState<CouponUsage[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "create" | "edit" | "usage">("list");
  const [selectedCoupon, setSelectedCoupon] = useState<Partial<Coupon> | null>(null);

  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Request failed");
    }
    return res.json();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [cData, uData, sData] = await Promise.all([
        adminFetch("/api/admin/coupons"),
        adminFetch("/api/admin/coupons/usage"),
        supabase.from("subjects").select("id, title").order("title")
      ]);
      setCoupons(cData.coupons);
      setUsage(uData.usage);
      setSubjects(sData.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleBlockIP = async (ip: string) => {
    if (!confirm(`Block IP: ${ip}?`)) return;
    try {
      await adminFetch("/api/admin/blocked-ips", {
        method: "POST",
        body: JSON.stringify({ action: "block", ip_address: ip, reason: "Abusive coupon usage" }),
      });
      alert("IP Blocked");
    } catch (e) {
      alert("Failed to block IP");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (view === "create") {
        await adminFetch("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify({ action: "create", ...selectedCoupon }),
        });
      } else {
        await adminFetch("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify({ action: "update", ...selectedCoupon }),
        });
      }
      await loadData();
      setView("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will delete all usage history too.")) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/coupons", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-primary tracking-tight">Coupons</h1>
          <p className="text-on-surface-variant font-medium mt-1">Manage discounts and usage limits.</p>
        </div>
        <div className="flex gap-3">
           <button 
            onClick={() => setView(view === "usage" ? "list" : "usage")}
            className="h-12 px-6 bg-white border border-outline text-primary font-bold text-sm rounded-xl hover:bg-slate-50 transition-all shadow-sm"
           >
            {view === "usage" ? "View Coupons" : "Usage History"}
           </button>
           <button 
            onClick={() => {
              setSelectedCoupon({
                code: "",
                discount_type: "percentage",
                discount_value: 0,
                is_active: true,
                is_new_user_only: false,
                min_order_cents: 0
              });
              setView("create");
            }}
            className="h-12 px-8 bg-primary text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all shadow-premium"
           >
            + New Coupon
           </button>
        </div>
      </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 font-bold text-sm flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          {view === "list" && (
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-outline/40">
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Status</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Coupon Code</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Discount</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Usage</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Eligibility</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Expiry</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/40">
                    {coupons.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${c.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                            {c.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="p-5">
                          <div className="font-black text-primary text-base">{c.code}</div>
                          <div className="text-[10px] text-on-surface-variant/60 font-medium">{c.description || "No description"}</div>
                        </td>
                        <td className="p-5">
                          <div className="font-bold text-primary">
                            {c.discount_type === "percentage" ? `${c.discount_value}%` : `${c.discount_value} EGP`}
                          </div>
                          <div className="text-[10px] text-on-surface-variant/60">
                            Min: {c.min_order_cents / 100} EGP
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${Math.min(100, (c.used_count / (c.total_usage_limit || c.used_count || 1)) * 100)}%` }} 
                              />
                            </div>
                            <span className="text-[10px] font-bold text-primary">{c.used_count} / {c.total_usage_limit || "∞"}</span>
                          </div>
                        </td>
                        <td className="p-5">
                           <div className="space-y-1">
                             <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${c.is_new_user_only ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                               {c.is_new_user_only ? "New Users Only" : "All Users"}
                             </span>
                             {c.subject_id && (
                               <div className="text-[9px] font-bold text-on-surface-variant/60 mt-1">
                                 Linked to: {subjects.find(s => s.id === c.subject_id)?.title || "Subject"}
                               </div>
                             )}
                           </div>
                        </td>
                        <td className="p-5">
                          <div className="text-xs font-bold text-primary">
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                          </div>
                        </td>
                        <td className="p-5">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => { setSelectedCoupon(c); setView("edit"); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-primary hover:bg-primary hover:text-white transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(c.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === "usage" && (
             <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
               <div className="p-6 border-b border-outline/40">
                 <h3 className="font-bold text-primary">Usage Tracking</h3>
               </div>
               <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest">Time</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest">User</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest">Coupon</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest">Discount</th>
                      <th className="p-5 text-[10px] font-black uppercase tracking-widest">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/40">
                    {usage.map((u) => (
                      <tr key={u.id} className="text-sm">
                        <td className="p-5 font-medium text-on-surface-variant">{new Date(u.used_at).toLocaleString()}</td>
                        <td className="p-5">
                          <div className="font-bold text-primary">{u.profile.full_name}</div>
                          <div className="text-[10px] text-on-surface-variant/60">{u.profile.email}</div>
                        </td>
                        <td className="p-5"><span className="font-black text-primary">{u.coupon.code}</span></td>
                        <td className="p-5 font-bold text-green-600">-{u.discount_applied_cents / 100} EGP</td>
                        <td className="p-5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-on-surface-variant">{u.ip_address}</span>
                            <button className="text-[10px] font-black text-rose-600 uppercase hover:underline">Block</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
             </div>
          )}

          {(view === "create" || view === "edit") && selectedCoupon && (
            <div className="max-w-3xl mx-auto bg-white border border-outline/60 shadow-soft-2xl rounded-[2.5rem] p-8 sm:p-12">
               <h2 className="text-2xl font-black text-primary mb-8">{view === "create" ? "Create New Coupon" : "Edit Coupon"}</h2>
               <form onSubmit={handleSave} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Coupon Code</label>
                      <input 
                        required
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all uppercase"
                        value={selectedCoupon.code}
                        onChange={e => setSelectedCoupon({...selectedCoupon, code: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Discount Type</label>
                      <select 
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.discount_type}
                        onChange={e => setSelectedCoupon({...selectedCoupon, discount_type: e.target.value as any})}
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (EGP)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Value</label>
                      <input 
                        type="number"
                        required
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.discount_value}
                        onChange={e => setSelectedCoupon({...selectedCoupon, discount_value: Number(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Min Order (EGP)</label>
                      <input 
                        type="number"
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={(selectedCoupon.min_order_cents || 0) / 100}
                        onChange={e => setSelectedCoupon({...selectedCoupon, min_order_cents: Number(e.target.value) * 100})}
                      />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Description</label>
                    <textarea 
                      className="w-full p-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-medium text-primary focus:border-primary outline-none transition-all min-h-[100px]"
                      value={selectedCoupon.description || ""}
                      onChange={e => setSelectedCoupon({...selectedCoupon, description: e.target.value})}
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Total Usage Limit (Optional)</label>
                      <input 
                        type="number"
                        placeholder="Unlimited"
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.total_usage_limit || ""}
                        onChange={e => setSelectedCoupon({...selectedCoupon, total_usage_limit: e.target.value ? Number(e.target.value) : null})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Link to Subject (Optional)</label>
                      <select 
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.subject_id || ""}
                        onChange={e => setSelectedCoupon({...selectedCoupon, subject_id: e.target.value || null})}
                      >
                        <option value="">All Subjects</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Starts At</label>
                      <input 
                        type="datetime-local"
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.start_at ? new Date(selectedCoupon.start_at).toISOString().slice(0, 16) : ""}
                        onChange={e => setSelectedCoupon({...selectedCoupon, start_at: new Date(e.target.value).toISOString()})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Expires At (Optional)</label>
                      <input 
                        type="datetime-local"
                        className="w-full h-14 px-5 bg-slate-50 border-2 border-outline/40 rounded-2xl font-black text-primary focus:border-primary outline-none transition-all"
                        value={selectedCoupon.expires_at ? new Date(selectedCoupon.expires_at).toISOString().slice(0, 16) : ""}
                        onChange={e => setSelectedCoupon({...selectedCoupon, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null})}
                      />
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-6 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-2 border-outline/40 text-primary focus:ring-primary"
                        checked={selectedCoupon.is_active}
                        onChange={e => setSelectedCoupon({...selectedCoupon, is_active: e.target.checked})}
                      />
                      <span className="text-sm font-bold text-primary group-hover:text-secondary transition-colors">Coupon is Active</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-2 border-outline/40 text-primary focus:ring-primary"
                        checked={selectedCoupon.is_new_user_only}
                        onChange={e => setSelectedCoupon({...selectedCoupon, is_new_user_only: e.target.checked})}
                      />
                      <span className="text-sm font-bold text-primary group-hover:text-secondary transition-colors">New Users Only</span>
                    </label>
                 </div>

                 <div className="flex gap-4 pt-8 border-t border-outline/30">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex-1 h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-premium disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Coupon"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setView("list")}
                      className="h-14 px-8 border-2 border-outline text-on-surface-variant font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                 </div>
               </form>
            </div>
          )}
    </div>
  );
}
