import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization");
    const guard = await requireAdminFromBearer(auth);
    if (!guard.ok) {
      const reason =
        guard.status === 401
          ? "missing_or_invalid_token"
          : guard.status === 403
            ? "not_admin"
            : "forbidden";
      return NextResponse.json(
        { ok: false, reason, userId: "userId" in guard ? guard.userId : undefined },
        { status: guard.status },
      );
    }
    return NextResponse.json({ ok: true, userId: guard.userId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[/api/admin/me] error:", msg);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
