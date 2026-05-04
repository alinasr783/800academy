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
          </div>

          {/* Top Geographic Locations - Full Width */}
          <div className="bg-white p-6 rounded-2xl border border-outline/30 shadow-sm">
            <h3 className="font-semibold text-lg mb-6">Top Geographic Locations (City)</h3>
            <GeographyChart data={data.geographyData} />
          </div>
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
