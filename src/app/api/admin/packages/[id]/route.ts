import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SubjectRow = {
  id: string;
  slug: string;
  title: string;
  marketing_title: string | null;
  track: string | null;
  card_description: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type OfferRow = {
  id: string;
  subject_id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

type SubjectAssetRow = {
  id: string;
  subject_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  alt: string | null;
  sort_order: number;
  created_at: string;
};

function getAdminOrFail() {
  try {
    return { admin: getSupabaseAdmin() as ReturnType<typeof getSupabaseAdmin>, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return { admin: null, error: msg };
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { data: subject, error } = await admin
    .from("subjects")
    .select("id,slug,title,marketing_title,track,card_description,description,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: offers } = await admin
    .from("subject_offers")
    .select("id,subject_id,label,expires_at,price_cents,currency,created_at,updated_at")
    .eq("subject_id", id)
    .order("expires_at", { ascending: true });

  const { data: assets } = await admin
    .from("subject_assets")
    .select("id,subject_id,bucket,storage_path,url,alt,sort_order,created_at")
    .eq("subject_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json({
    subject: subject as SubjectRow,
    offers: (offers ?? []) as OfferRow[],
    assets: (assets ?? []) as SubjectAssetRow[],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as
    | {
        slug?: string;
        title?: string;
        marketing_title?: string | null;
        track?: string | null;
        card_description?: string | null;
        description?: string | null;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const patch: Record<string, unknown> = {};
  if ("slug" in body && typeof body.slug === "string") patch.slug = body.slug.trim();
  if ("title" in body && typeof body.title === "string") patch.title = body.title.trim();
  if ("track" in body) patch.track = body.track ?? null;
  if ("marketing_title" in body) patch.marketing_title = body.marketing_title ?? null;
  if ("card_description" in body) patch.card_description = body.card_description ?? null;
  if ("description" in body) patch.description = body.description ?? null;

  const { data, error } = await admin
    .from("subjects")
    .update(patch)
    .eq("id", id)
    .select("id,slug,title,marketing_title,track,card_description,description,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subject: data as SubjectRow });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { error } = await admin.from("subjects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id: subjectId } = await params;
  const body = (await req.json().catch(() => null)) as
    | (
        | {
            action: "create_offer";
            label: string;
            expires_at: string;
            price_cents: number;
            currency?: string;
          }
        | {
            action: "update_offer";
            offer_id: string;
            label?: string;
            expires_at?: string;
            price_cents?: number;
            currency?: string;
          }
        | { action: "delete_offer"; offer_id: string }
        | {
            action: "create_asset";
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            alt?: string | null;
            sort_order?: number;
          }
        | {
            action: "update_asset";
            asset_id: string;
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            alt?: string | null;
            sort_order?: number;
          }
        | { action: "delete_asset"; asset_id: string }
      )
    | null;

  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "create_offer") {
    if (!body.label?.trim() || !body.expires_at || typeof body.price_cents !== "number") {
      return NextResponse.json({ error: "Missing offer fields." }, { status: 400 });
    }
    const { data, error } = await admin
      .from("subject_offers")
      .insert({
        subject_id: subjectId,
        label: body.label.trim(),
        expires_at: new Date(body.expires_at).toISOString(),
        price_cents: Math.max(0, Math.trunc(body.price_cents)),
        currency: body.currency?.trim() || "EGP",
      })
      .select("id,subject_id,label,expires_at,price_cents,currency,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ offer: data as OfferRow });
  }

  if (body.action === "update_offer") {
    const offerId = body.offer_id;
    if (!offerId) return NextResponse.json({ error: "Missing offer_id." }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if ("label" in body && typeof body.label === "string") patch.label = body.label.trim();
    if ("expires_at" in body && typeof body.expires_at === "string") {
      patch.expires_at = new Date(body.expires_at).toISOString();
    }
    if ("price_cents" in body && typeof body.price_cents === "number") {
      patch.price_cents = Math.max(0, Math.trunc(body.price_cents));
    }
    if ("currency" in body && typeof body.currency === "string" && body.currency.trim()) {
      patch.currency = body.currency.trim();
    }

    const { data, error } = await admin
      .from("subject_offers")
      .update(patch)
      .eq("id", offerId)
      .eq("subject_id", subjectId)
      .select("id,subject_id,label,expires_at,price_cents,currency,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ offer: data as OfferRow });
  }

  if (body.action === "delete_offer") {
    const offerId = body.offer_id;
    if (!offerId) return NextResponse.json({ error: "Missing offer_id." }, { status: 400 });
    const { error } = await admin.from("subject_offers").delete().eq("id", offerId).eq("subject_id", subjectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_asset") {
    const { data, error } = await admin
      .from("subject_assets")
      .insert({
        subject_id: subjectId,
        bucket: body.bucket?.trim() || "assets",
        storage_path: body.storage_path ?? null,
        url: body.url ?? null,
        alt: body.alt ?? null,
        sort_order: Math.trunc(body.sort_order ?? 0),
      })
      .select("id,subject_id,bucket,storage_path,url,alt,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as SubjectAssetRow });
  }

  if (body.action === "update_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if ("bucket" in body && typeof body.bucket === "string") patch.bucket = body.bucket.trim() || "assets";
    if ("storage_path" in body) patch.storage_path = body.storage_path ?? null;
    if ("url" in body) patch.url = body.url ?? null;
    if ("alt" in body) patch.alt = body.alt ?? null;
    if ("sort_order" in body && typeof body.sort_order === "number") patch.sort_order = Math.trunc(body.sort_order);

    const { data, error } = await admin
      .from("subject_assets")
      .update(patch)
      .eq("id", assetId)
      .eq("subject_id", subjectId)
      .select("id,subject_id,bucket,storage_path,url,alt,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as SubjectAssetRow });
  }

  if (body.action === "delete_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });
    const { error } = await admin.from("subject_assets").delete().eq("id", assetId).eq("subject_id", subjectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
