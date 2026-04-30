"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { format, parseISO, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
// Data fetching is protected by DashboardLayout and DashboardGuard.

export async function getDashboardAnalytics(startDateStr: string, endDateStr: string) {
  const supabase = getSupabaseAdmin();
  const startDate = startOfDay(parseISO(startDateStr));
  const endDate = endOfDay(parseISO(endDateStr));
  
  const isoStart = startDate.toISOString();
  const isoEnd = endDate.toISOString();

  // 1. Fetch Visits
  const { data: visits } = await supabase
    .from("page_visits")
    .select("created_at, country, city, ip_address")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // 2. Fetch Profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // 3. Fetch Transactions (for revenue AND subscriptions)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("created_at, amount, status, type")
    .eq("status", "completed")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // --- Aggregate Data ---
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const formatDay = (date: Date) => format(date, "MMM dd");

  // Initialize aggregated arrays
  const chartData = days.map((day) => ({
    date: formatDay(day),
    visitors: 0,
    accounts: 0,
    subscriptions: 0,
    revenue: 0,
  }));

  const geographyMap: Record<string, number> = {};
  const uniqueIpsMap: Record<string, { count: number; city: string; country: string; firstVisit: string; lastVisit: string }> = {};

  let totalAccounts = 0;
  let totalSubscriptions = 0;
  let totalRevenue = 0;

  // Helper to find index in chartData
  const getDayIndex = (dateStr: string) => {
    const dayFormatted = formatDay(parseISO(dateStr));
    return chartData.findIndex((d) => d.date === dayFormatted);
  };

  // Process Visits
  if (visits) {
    visits.forEach((v) => {
      // Handle Unique IPs
      const ip = v.ip_address || "unknown";
      if (!uniqueIpsMap[ip]) {
        uniqueIpsMap[ip] = {
          count: 0,
          city: v.city || "Unknown",
          country: v.country || "Unknown",
          firstVisit: v.created_at,
          lastVisit: v.created_at,
        };
        // Add to daily chart ONLY on their first visit of the session to represent "unique" daily visitors
        const idx = getDayIndex(v.created_at);
        if (idx !== -1) chartData[idx].visitors++;
      }
      
      uniqueIpsMap[ip].count++;
      // Update last visit time
      if (new Date(v.created_at) > new Date(uniqueIpsMap[ip].lastVisit)) {
        uniqueIpsMap[ip].lastVisit = v.created_at;
      }
    });
  }

  const uniqueVisitors = Object.keys(uniqueIpsMap).length;
  
  // Now aggregate geography based on unique visitors, not page views, for better accuracy
  Object.values(uniqueIpsMap).forEach((visitor) => {
    const geoKey = visitor.city !== "Unknown" ? `${visitor.city}, ${visitor.country}` : visitor.country;
    geographyMap[geoKey] = (geographyMap[geoKey] || 0) + 1;
  });

  // Process Profiles
  if (profiles) {
    totalAccounts = profiles.length;
    profiles.forEach((p) => {
      const idx = getDayIndex(p.created_at);
      if (idx !== -1) chartData[idx].accounts++;
    });
  }

  // Process Subscriptions and Revenue from Transactions
  if (transactions) {
    transactions.forEach((t) => {
      const amount = Number(t.amount) || 0;
      totalRevenue += amount;
      const idx = getDayIndex(t.created_at);
      if (idx !== -1) {
        chartData[idx].revenue += amount;
        if (t.type === 'subscription') {
           chartData[idx].subscriptions++;
           totalSubscriptions++;
        }
      }
    });
  }

  const geographyData = Object.entries(geographyMap)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // top 10

  const ipList = Object.entries(uniqueIpsMap)
    .map(([ip, data]) => ({ ip, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 100); // Send top 100 IPs for the dashboard table

  const conversionRate = uniqueVisitors > 0 ? ((totalSubscriptions / uniqueVisitors) * 100).toFixed(2) : "0.00";

  return {
    kpis: {
      totalVisitors: uniqueVisitors,
      totalAccounts,
      totalSubscriptions,
      totalRevenue,
      conversionRate,
    },
    chartData,
    geographyData,
    ipList,
  };
}

// Server Action to fetch full history for a specific IP
export async function getIpHistory(ipAddress: string, startDateStr: string, endDateStr: string) {
  const supabase = getSupabaseAdmin();
  const startDate = startOfDay(parseISO(startDateStr)).toISOString();
  const endDate = endOfDay(parseISO(endDateStr)).toISOString();

  const { data } = await supabase
    .from("page_visits")
    .select("created_at, path")
    .eq("ip_address", ipAddress)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false });

  return data || [];
}
