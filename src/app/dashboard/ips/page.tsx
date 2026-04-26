"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type BlockedIP = {
  ip_address: string;
  reason: string | null;
  blocked_at: string;
};

export default function BlockedIPsDashboard() {
  const [blocked, setBlocked] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newIP, setNewIP] = useState("");
  const [newReason, setNewReason] = useState("");

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
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/api/admin/blocked-ips");
      setBlocked(data.blocked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIP) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/blocked-ips", {
        method: "POST",
        body: JSON.stringify({ action: "block", ip_address: newIP, reason: newReason }),
      });
      setNewIP("");
      setNewReason("");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to block");
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!confirm(`Unblock ${ip}?`)) return;
    setSaving(true);
    try {
      await adminFetch("/api/admin/blocked-ips", {
        method: "POST",
        body: JSON.stringify({ action: "unblock", ip_address: ip }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unblock");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-primary font-bold">Loading Blacklist...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold text-primary tracking-tight text-red-600">IP Blacklist</h1>
        <p className="text-on-surface-variant font-medium mt-1">Ban specific devices from using coupons or accessing checkout.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Block Form */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl p-6 sticky top-8">
            <h3 className="font-black text-primary uppercase tracking-widest text-xs mb-6">Block New Address</h3>
            <form onSubmit={handleBlock} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">IP Address</label>
                <input 
                  required
                  placeholder="e.g. 192.168.1.1"
                  className="w-full h-12 px-4 bg-slate-50 border border-outline/40 rounded-xl font-bold text-primary focus:border-red-500 outline-none transition-all"
                  value={newIP}
                  onChange={e => setNewIP(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">Reason</label>
                <textarea 
                  placeholder="Abusive behavior..."
                  className="w-full p-4 bg-slate-50 border border-outline/40 rounded-xl font-medium text-primary focus:border-red-500 outline-none transition-all min-h-[100px]"
                  value={newReason}
                  onChange={e => setNewReason(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={saving}
                className="w-full h-12 bg-red-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-md disabled:opacity-50"
              >
                {saving ? "Processing..." : "Block IP Address"}
              </button>
            </form>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-outline/40">
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest">IP Address</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest">Reason</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest">Date Blocked</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/40">
                  {blocked.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-on-surface-variant font-medium">No blocked IP addresses.</td>
                    </tr>
                  ) : (
                    blocked.map((item) => (
                      <tr key={item.ip_address} className="hover:bg-rose-50/30 transition-colors">
                        <td className="p-5 font-mono text-sm font-bold text-primary">{item.ip_address}</td>
                        <td className="p-5 text-sm text-on-surface-variant">{item.reason || "—"}</td>
                        <td className="p-5 text-xs text-on-surface-variant/60 font-medium">{new Date(item.blocked_at).toLocaleString()}</td>
                        <td className="p-5 text-center">
                           <button 
                             onClick={() => handleUnblock(item.ip_address)}
                             disabled={saving}
                             className="text-[10px] font-black text-green-600 uppercase tracking-widest hover:underline"
                           >
                             Unblock
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
