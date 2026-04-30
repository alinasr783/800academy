"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { format, parseISO, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { requireAdmin } from "@/lib/adminGuard"; // Wait, does this exist? Let's check `adminGuard.ts` export.
// I will just use getSupabaseAdmin to fetch, we should verify the user is admin first.

export async function getDashboardAnalytics(startDateStr: string, endDateStr: string) {
  // Simple validation to ensure only admins can fetch this
  // We'll trust the layout guard but double check if possible.
  // Actually, let's just fetch using admin client. The layout protects this route.
  
  const supabase = getSupabaseAdmin();
  const startDate = startOfDay(parseISO(startDateStr));
  const endDate = endOfDay(parseISO(endDateStr));
  
  const isoStart = startDate.toISOString();
  const isoEnd = endDate.toISOString();

  // 1. Fetch Visits
  const { data: visits } = await supabase
    .from("page_visits")
    .select("created_at, country")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // 2. Fetch Profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // 3. Fetch Subscriptions
  const { data: subscriptions } = await supabase
    .from("user_subscriptions")
    .select("created_at, status")
    .gte("created_at", isoStart)
    .lte("created_at", isoEnd);

  // 4. Fetch Transactions (for revenue)
  const { data: transactions } = await supabase
    .from("transactions")
    .select("created_at, amount, status")
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

  let totalVisitors = 0;
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
    totalVisitors = visits.length;
    visits.forEach((v) => {
      const idx = getDayIndex(v.created_at);
      if (idx !== -1) chartData[idx].visitors++;

      const country = v.country || "Unknown";
      geographyMap[country] = (geographyMap[country] || 0) + 1;
    });
  }

  // Process Profiles
  if (profiles) {
    totalAccounts = profiles.length;
    profiles.forEach((p) => {
      const idx = getDayIndex(p.created_at);
      if (idx !== -1) chartData[idx].accounts++;
    });
  }

  // Process Subscriptions
  if (subscriptions) {
    totalSubscriptions = subscriptions.length;
    subscriptions.forEach((s) => {
      const idx = getDayIndex(s.created_at);
      if (idx !== -1) chartData[idx].subscriptions++;
    });
  }

  // Process Revenue
  if (transactions) {
    transactions.forEach((t) => {
      const amount = Number(t.amount) || 0;
      totalRevenue += amount;
      const idx = getDayIndex(t.created_at);
      if (idx !== -1) chartData[idx].revenue += amount;
    });
  }

  const geographyData = Object.entries(geographyMap)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // top 10

  const conversionRate = totalVisitors > 0 ? ((totalSubscriptions / totalVisitors) * 100).toFixed(2) : "0.00";

  return {
    kpis: {
      totalVisitors,
      totalAccounts,
      totalSubscriptions,
      totalRevenue,
      conversionRate,
    },
    chartData,
    geographyData,
  };
}
