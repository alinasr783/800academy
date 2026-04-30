import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get profile data
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("current_streak, last_activity_date, longest_streak")
    .eq("id", user.id)
    .single();

  // Calculate current week (Saturday to Friday)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
  
  // Saturday is 6. If today is Sat (6), offset is 0. If Sun (0), offset is -1. If Mon (1), offset is -2.
  // Formula: (dayOfWeek - 6 + 7) % 7
  const daysSinceSaturday = (dayOfWeek + 1) % 7; 
  // Wait, let's re-calculate:
  // Sat: 6 -> (6+1)%7 = 0
  // Sun: 0 -> (0+1)%7 = 1
  // Mon: 1 -> (1+1)%7 = 2
  // ...
  // Fri: 5 -> (5+1)%7 = 6
  // This works!
  
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - daysSinceSaturday);
  saturday.setHours(0, 0, 0, 0);

  const { data: activities } = await supabaseAdmin
    .from("user_activities")
    .select("activity_date")
    .eq("user_id", user.id)
    .gte("activity_date", saturday.toISOString().split('T')[0])
    .order("activity_date", { ascending: true });

  const activityDates = new Set(activities?.map(a => a.activity_date) || []);
  
  // Build week status
  const weekStatus = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    weekStatus.push({
      date: dateStr,
      dayName: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i],
      active: activityDates.has(dateStr)
    });
  }

  return NextResponse.json({
    currentStreak: profile?.current_streak || 0,
    longestStreak: profile?.longest_streak || 0,
    lastActivityDate: profile?.last_activity_date,
    weekStatus
  });
}

export async function POST(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  // 1. Get current profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("current_streak, last_activity_date, longest_streak")
    .eq("id", user.id)
    .single();

  const lastActivity = profile?.last_activity_date;
  let newStreak = profile?.current_streak || 0;
  let streakUpdated = false;

  if (lastActivity === today) {
    // Already active today, nothing to change in streak
  } else if (lastActivity === yesterday) {
    // Active yesterday, continue streak
    newStreak += 1;
    streakUpdated = true;
  } else {
    // Missed a day or first time
    newStreak = 1;
    streakUpdated = true;
  }

  // 2. Record activity
  const { error: activityError } = await supabaseAdmin
    .from("user_activities")
    .upsert({ user_id: user.id, activity_date: today }, { onConflict: 'user_id,activity_date' });

  if (activityError) return NextResponse.json({ error: activityError.message }, { status: 500 });

  // 3. Update profile
  if (streakUpdated || lastActivity !== today) {
    const updateData: any = {
      current_streak: newStreak,
      last_activity_date: today,
    };
    if (newStreak > (profile?.longest_streak || 0)) {
      updateData.longest_streak = newStreak;
    }

    await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    // 4. Send Automated Notification if streak increased
    if (streakUpdated) {
      // Find or create a notification type for streak
      const { data: notifType } = await supabaseAdmin
        .from("notification_types")
        .select("id")
        .eq("name", "Streak Milestone")
        .single();
      
      const typeId = notifType?.id;

      await supabaseAdmin
        .from("notifications")
        .insert({
          title: "Streak Updated! 🔥",
          body: `You've kept your streak alive for ${newStreak} days! Keep it up!`,
          type_id: typeId,
          target_user_id: user.id,
          actions: [{ label: "View Profile", href: "/profile" }]
        });
    }
  }

  return NextResponse.json({
    success: true,
    currentStreak: newStreak,
    streakUpdated
  });
}
