"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Visitor = {
  id: string;
  ip_address: string;
  country: string;
  city: string;
  user_agent: string | null;
  device_type: string;
  last_path: string;
  last_visit: string;
  has_account: boolean;
  account: any;
};

type Stats = { total: number; uniqueIps: number };

const DEVICE_ICONS: Record<string, string> = {
  mobile: "smartphone",
  tablet: "tablet",
  desktop: "desktop_windows",
  bot: "smart_toy",
  unknown: "devices",
};

export default function VisitorsPage() {
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, uniqueIps: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterDevice, setFilterDevice] = useState("");
  const [filterTime, setFilterTime] = useState("all");
  const [filterIP, setFilterIP] = useState("");

  // Blocking
  const [blockReason, setBlockReason] = useState("");
  const [blockingIp, setBlockingIp] = useState<string | null>(null);
  const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());

  // IP History tracking
  const [trackingIP, setTrackingIP] = useState<string | null>(null);
  const [ipHistory, setIpHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchBlockedIps = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/blocked-ips", {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      const json = await res.json();
      setBlockedIps(new Set((json.items || []).map((b: any) => b.ip_address)));
    } catch { }
  }, []);

  const fetchVisitors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const params = new URLSearchParams();
      if (filterCountry) params.set("country", filterCountry);
      if (filterCity) params.set("city", filterCity);
      if (filterDevice) params.set("device", filterDevice);
      if (filterTime && filterTime !== "all") params.set("time", filterTime);
      if (filterIP) params.set("ip", filterIP);
      params.set("page", String(page));
      params.set("limit", "50");

      const res = await fetch(`/api/admin/visitors?${params}`, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      setVisitors(json.visitors || []);
      setStats({ total: json.total || 0, uniqueIps: json.uniqueIps || 0 });
      setTotalPages(Math.ceil((json.total || 0) / 50));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterCity, filterDevice, filterTime, filterIP, page]);

  async function fetchIpHistory(ip: string) {
    setTrackingIP(ip);
    setLoadingHistory(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const params = new URLSearchParams({ ip });
      const res = await fetch(`/api/admin/visitors/history?${params}`, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      const json = await res.json();
      setIpHistory(json.history || []);
    } catch {
      setError("Failed to load IP history");
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchBlockedIps();
    fetchVisitors();
  }, [fetchVisitors, fetchBlockedIps]);

  async function handleBlock(ip: string) {
    if (!blockReason.trim()) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await fetch("/api/admin/blocked-ips", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "block", ip_address: ip, reason: blockReason }),
      });
      setBlockedIps(prev => new Set(prev).add(ip));
      setBlockingIp(null);
      setBlockReason("");
    } catch { }
  }

  async function handleUnblock(ip: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await fetch("/api/admin/blocked-ips", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "unblock", ip_address: ip }),
      });
      setBlockedIps(prev => {
        const next = new Set(prev);
        next.delete(ip);
        return next;
      });
    } catch { }
  }

  const deviceOptions = ["", "desktop", "mobile", "tablet", "bot"];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Analytics</div>
        <h1 className="mt-2 text-3xl font-black text-primary tracking-tight">Unique Visitors</h1>
        <p className="mt-2 text-on-surface-variant font-medium">IP-based visitor tracking with geo, device, and account detection.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-soft-xl">
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest">Total Visits</div>
          <div className="text-3xl font-black text-primary mt-1">{stats.total}</div>
        </div>
        <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-soft-xl">
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest">Unique IPs</div>
          <div className="text-3xl font-black text-primary mt-1">{stats.uniqueIps}</div>
        </div>
        <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-soft-xl">
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest">Blocked IPs</div>
          <div className="text-3xl font-black text-rose-600 mt-1">{blockedIps.size}</div>
        </div>
        <div className="bg-white border border-outline/40 rounded-2xl p-5 shadow-soft-xl">
          <div className="text-[10px] font-black text-secondary uppercase tracking-widest">Showing</div>
          <div className="text-3xl font-black text-primary mt-1">{visitors.length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-outline/40 rounded-3xl p-6 shadow-soft-xl">
        <div className="text-xs font-black text-primary uppercase tracking-widest mb-4">Filters</div>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={filterCountry}
            onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
            placeholder="Country..."
            className="px-4 py-2.5 border border-outline/40 rounded-xl text-sm font-bold outline-none focus:border-primary transition-colors"
          />
          <input
            type="text"
            value={filterCity}
            onChange={(e) => { setFilterCity(e.target.value); setPage(1); }}
            placeholder="City..."
            className="px-4 py-2.5 border border-outline/40 rounded-xl text-sm font-bold outline-none focus:border-primary transition-colors"
          />
          <select
            value={filterDevice}
            onChange={(e) => { setFilterDevice(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-outline/40 rounded-xl text-sm font-bold outline-none focus:border-primary transition-colors bg-white"
          >
            {deviceOptions.map(d => (
              <option key={d} value={d}>{d || "All Devices"}</option>
            ))}
          </select>
          <input
            type="text"
            value={filterIP}
            onChange={(e) => { setFilterIP(e.target.value); setPage(1); }}
            placeholder="Search IP..."
            className="px-4 py-2.5 border border-outline/40 rounded-xl text-sm font-bold font-mono outline-none focus:border-primary transition-colors"
          />
          <select
            value={filterTime}
            onChange={(e) => { setFilterTime(e.target.value); setPage(1); }}
            className="px-4 py-2.5 border border-outline/40 rounded-xl text-sm font-bold outline-none focus:border-primary transition-colors bg-white"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
          {(filterCountry || filterCity || filterDevice || filterTime !== "all") && (
            <button
              onClick={() => { setFilterCountry(""); setFilterCity(""); setFilterDevice(""); setFilterTime("all"); setPage(1); }}
              className="px-4 py-2.5 text-rose-600 font-bold text-sm hover:bg-rose-50 rounded-xl transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 font-bold text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white border border-outline/40 rounded-3xl shadow-soft-xl overflow-hidden">
        {loading ? (
          <div className="p-20 text-center font-bold text-on-surface-variant animate-pulse">Loading...</div>
        ) : visitors.length === 0 ? (
          <div className="p-20 text-center font-bold text-on-surface-variant">No visitors found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline/40">
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">IP Address</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Country</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">City</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Device</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Account</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Last Path</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Last Visit</th>
                  <th className="p-4 text-[10px] font-black text-secondary uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map(v => (
                  <tr key={v.id} className="border-b border-outline/20 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-sm font-mono text-primary">
                      <button
                        onClick={() => fetchIpHistory(v.ip_address)}
                        className="hover:underline hover:text-secondary transition-colors cursor-pointer"
                        title="Click to track this IP"
                      >
                        {v.ip_address}
                      </button>
                    </td>
                    <td className="p-4 text-sm font-bold">{v.country}</td>
                    <td className="p-4 text-sm font-bold">{v.city}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        <span className="material-symbols-outlined text-sm">{DEVICE_ICONS[v.device_type] || "devices"}</span>
                        {v.device_type}
                      </span>
                    </td>
                    <td className="p-4">
                      {v.has_account ? (
                        <Link
                          href={`/dashboard/users/${v.account?.id || ""}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">person</span>
                          {v.account?.email || "Yes"}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">No Account</span>
                      )}
                    </td>
                    <td className="p-4 text-xs font-bold text-slate-500 max-w-[200px] truncate">{v.last_path}</td>
                    <td className="p-4 text-xs font-bold text-slate-500">{new Date(v.last_visit).toLocaleString()}</td>
                    <td className="p-4">
                      {blockedIps.has(v.ip_address) ? (
                        <button
                          onClick={() => handleUnblock(v.ip_address)}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors"
                        >
                          Unblock
                        </button>
                      ) : blockingIp === v.ip_address ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            placeholder="Reason..."
                            className="w-24 px-2 py-1 border rounded text-xs font-bold outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleBlock(v.ip_address)}
                            className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-black uppercase"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => { setBlockingIp(null); setBlockReason(""); }}
                            className="text-slate-400 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setBlockingIp(v.ip_address)}
                          className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors"
                        >
                          Block
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-outline/20">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-outline/40 text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              Prev
            </button>
            <span className="text-xs font-bold text-slate-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-outline/40 text-xs font-bold disabled:opacity-30 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* IP History Modal */}
      {trackingIP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-outline/30">
              <div>
                <h2 className="text-xl font-bold font-headline">IP Visit History</h2>
                <p className="text-sm font-mono text-primary mt-1">{trackingIP}</p>
              </div>
              <button 
                onClick={() => { setTrackingIP(null); setIpHistory([]); }}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : ipHistory.length === 0 ? (
                <p className="text-center text-on-surface-variant">No history found for this IP.</p>
              ) : (
                <div className="space-y-4">
                  {ipHistory.map((visit, i) => (
                    <div key={visit.id || i} className="relative flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-sm">{i === 0 ? 'where_to_vote' : 'ads_click'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-primary break-all">{visit.path}</span>
                          {visit.country !== "Unknown" && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                              {visit.city !== "Unknown" ? `${visit.city}, ` : ""}{visit.country}
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold capitalize">{visit.device}</span>
                        </div>
                        <time className="text-xs font-medium text-slate-400">
                          {new Date(visit.created_at).toLocaleString("en-US", { 
                            year: "numeric", month: "short", day: "numeric", 
                            hour: "2-digit", minute: "2-digit", second: "2-digit" 
                          })}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
 }
