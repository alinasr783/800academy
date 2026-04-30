"use client";

import { useState, useEffect } from "react";
import { getDashboardAnalytics, getIpHistory } from "./actions";
import { subDays, format, startOfDay } from "date-fns";
import { TrendsChart, RevenueChart, GeographyChart, ConversionFunnelChart } from "./Charts";

type DateRange = "today" | "yesterday" | "7days" | "30days" | "all";

export default function DashboardOverview() {
  const [dateRange, setDateRange] = useState<DateRange>("7days");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // IP History Modal State
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [ipHistory, setIpHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const now = new Date();
      let start = subDays(now, 7);
      let end = now;

      if (dateRange === "today") {
        start = startOfDay(now);
      } else if (dateRange === "yesterday") {
        start = startOfDay(subDays(now, 1));
        end = startOfDay(now); // Up to today
      } else if (dateRange === "30days") {
        start = subDays(now, 30);
      } else if (dateRange === "all") {
        start = new Date("2020-01-01"); // Arbitrary old date
      }

      try {
        const result = await getDashboardAnalytics(start.toISOString(), end.toISOString());
        setData(result);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  const handleIpClick = async (ip: string) => {
    setSelectedIp(ip);
    setLoadingHistory(true);
    try {
      const now = new Date();
      let start = subDays(now, 7);
      let end = now;

      if (dateRange === "today") start = startOfDay(now);
      else if (dateRange === "yesterday") { start = startOfDay(subDays(now, 1)); end = startOfDay(now); }
      else if (dateRange === "30days") start = subDays(now, 30);
      else if (dateRange === "all") start = new Date("2020-01-01");

      const history = await getIpHistory(ip, start.toISOString(), end.toISOString());
      setIpHistory(history);
    } catch (error) {
      console.error("Failed to fetch IP history", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary tracking-tight">Performance Overview</h1>
          <p className="text-on-surface-variant text-sm mt-1">Track unique visitors, subscriptions, and revenue.</p>
        </div>
        <div className="flex bg-surface-container-low p-1 rounded-xl">
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "7days", label: "Last 7 Days" },
            { id: "30days", label: "Last 30 Days" },
            { id: "all", label: "All Time" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as DateRange)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateRange === tab.id
                  ? "bg-white text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard title="Unique Visitors (IPs)" value={data.kpis.totalVisitors} icon="group" color="text-[#00D4FF]" bg="bg-[#00D4FF]/10" />
            <KpiCard title="New Accounts" value={data.kpis.totalAccounts} icon="person_add" color="text-[#635BFF]" bg="bg-[#635BFF]/10" />
            <KpiCard title="Subscriptions" value={data.kpis.totalSubscriptions} icon="card_membership" color="text-[#FFB800]" bg="bg-[#FFB800]/10" />
            <KpiCard title="Total Revenue" value={`EGP ${data.kpis.totalRevenue}`} icon="payments" color="text-primary" bg="bg-primary/10" />
            <KpiCard title="Conversion Rate" value={`${data.kpis.conversionRate}%`} icon="trending_up" color="text-[#FF6B6B]" bg="bg-[#FF6B6B]/10" />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
              <h3 className="font-semibold text-lg mb-6">Traffic & Account Trends</h3>
              <TrendsChart data={data.chartData} />
            </div>
            <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
              <h3 className="font-semibold text-lg mb-6">Conversion Funnel</h3>
              <ConversionFunnelChart 
                visitors={data.kpis.totalVisitors} 
                accounts={data.kpis.totalAccounts} 
                subscriptions={data.kpis.totalSubscriptions} 
              />
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
              <h3 className="font-semibold text-lg mb-6">Revenue Over Time</h3>
              <RevenueChart data={data.chartData} />
            </div>
            <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
              <h3 className="font-semibold text-lg mb-6">Top Geographic Locations (City)</h3>
              <GeographyChart data={data.geographyData} />
            </div>
          </div>

          {/* Unique IPs Tracking Section */}
          <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Unique Visitors (IP Tracking)</h3>
              <span className="text-sm text-on-surface-variant font-medium">Top 100 IPs</span>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-outline/30">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low text-on-surface-variant">
                  <tr>
                    <th className="px-6 py-4 font-medium">IP Address</th>
                    <th className="px-6 py-4 font-medium">Location</th>
                    <th className="px-6 py-4 font-medium">Total Views</th>
                    <th className="px-6 py-4 font-medium">Last Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/30">
                  {data.ipList?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-on-surface-variant">No tracking data available for this period.</td>
                    </tr>
                  ) : (
                    data.ipList?.map((ipData: any) => (
                      <tr 
                        key={ipData.ip} 
                        onClick={() => handleIpClick(ipData.ip)}
                        className="hover:bg-surface-container-lowest transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono text-primary font-medium">{ipData.ip}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">location_on</span>
                            {ipData.city !== 'Unknown' ? `${ipData.city}, ` : ''}{ipData.country}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold">{ipData.count}</td>
                        <td className="px-6 py-4 text-on-surface-variant">{format(new Date(ipData.lastVisit), "MMM dd, hh:mm a")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* IP History Modal */}
          {selectedIp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-6 border-b border-outline/30 bg-surface-container-lowest">
                  <div>
                    <h2 className="text-xl font-bold font-headline">Visit History</h2>
                    <p className="text-sm font-mono text-primary mt-1">{selectedIp}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedIp(null)}
                    className="p-2 rounded-full hover:bg-surface-variant transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                  {loadingHistory ? (
                    <div className="flex justify-center py-10">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : ipHistory.length === 0 ? (
                    <p className="text-center text-on-surface-variant">No history found.</p>
                  ) : (
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline/30 before:to-transparent">
                      {ipHistory.map((visit, i) => (
                        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-primary/10 text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <span className="material-symbols-outlined text-[18px]">ads_click</span>
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-outline/30 bg-white shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <time className="text-xs font-medium text-primary">{format(new Date(visit.created_at), "MMM dd, yyyy")}</time>
                              <span className="text-xs font-medium text-on-surface-variant">{format(new Date(visit.created_at), "hh:mm:ss a")}</span>
                            </div>
                            <div className="text-sm font-medium text-on-surface break-all">{visit.path}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function KpiCard({ title, value, icon, color, bg }: { title: string, value: string | number, icon: string, color: string, bg: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-50 blur-2xl transition-all group-hover:scale-150 ${bg}`}></div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <p className="text-on-surface-variant font-medium text-sm">{title}</p>
          <div className={`p-2 rounded-lg ${bg} ${color}`}>
            <span className="material-symbols-outlined text-xl">{icon}</span>
          </div>
        </div>
        <h3 className="font-headline text-3xl font-bold tracking-tight text-on-surface">{value}</h3>
      </div>
    </div>
  );
}
