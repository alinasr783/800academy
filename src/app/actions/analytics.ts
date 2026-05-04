"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { headers } from "next/headers";
import crypto from "crypto";

// We need a service role client to bypass RLS for inserting analytics
const supabaseAdmin = getSupabaseAdmin();

export async function trackVisit(path: string) {
  try {
    const headersList = await headers();
    
    // Get IP address (varies by hosting provider, Vercel uses x-real-ip or x-forwarded-for)
    const ip = headersList.get("x-real-ip") || headersList.get("x-forwarded-for") || "unknown";
    
    // Get country and city from Vercel headers if available
    const country = headersList.get("x-vercel-ip-country") || "Unknown";
    const city = headersList.get("x-vercel-ip-city") || "Unknown";
    
    // Hash the IP with the user agent to create a privacy-preserving session hash
    const userAgent = headersList.get("user-agent") || "unknown";
    const sessionHash = crypto
      .createHash("sha256")
      .update(`${ip}-${userAgent}-${new Date().toISOString().split("T")[0]}`) // Hash rotates daily
      .digest("hex");

    await supabaseAdmin.from("page_visits").insert({
      session_hash: sessionHash,
      ip_address: ip,
      path: path,
      country: country,
      city: decodeURIComponent(city),
      user_agent: userAgent,
    });
    
    return { success: true };
  } catch (error) {
    console.error("Failed to track visit:", error);
    return { success: false };
  }
}
