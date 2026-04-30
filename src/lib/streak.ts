import { supabase } from "./supabaseClient";

export async function recordStreakActivity() {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;

    await fetch("/api/user/streak", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sess.session.access_token}`,
      },
    });
  } catch (err) {
    console.error("Failed to record streak activity:", err);
  }
}
