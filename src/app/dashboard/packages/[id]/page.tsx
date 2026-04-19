"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SubjectRow = {
  id: string;
  slug: string;
  title: string;
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

export default function DashboardPackageDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const subjectId = params.id;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [assets, setAssets] = useState<SubjectAssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [description, setDescription] = useState("");

  const [offerOpen, setOfferOpen] = useState(false);
  const [offerLabel, setOfferLabel] = useState("");
  const [offerExpires, setOfferExpires] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerCurrency, setOfferCurrency] = useState("EGP");

  const [assetFiles, setAssetFiles] = useState<File[]>([]);

  async function adminFetch(path: string, init?: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`)) as {
        subject: SubjectRow;
        offers: OfferRow[];
        assets: SubjectAssetRow[];
      };
      setSubject(json.subject);
      setOffers(json.offers ?? []);
      setAssets(json.assets ?? []);
      setSlug(json.subject.slug);
      setTitle(json.subject.title);
      setTrack(json.subject.track ?? "");
      setCardDescription(json.subject.card_description ?? "");
      setDescription(json.subject.description ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [subjectId]);

  async function saveSubject() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          slug: slug.trim(),
          title: title.trim(),
          track: track.trim() || null,
          card_description: cardDescription.trim() || null,
          description: description.trim() || null,
        }),
      })) as { subject: SubjectRow };
      setSubject(json.subject);
      setMessage("Saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject() {
    const ok = window.confirm("Delete this package permanently?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/packages/${subjectId}`, { method: "DELETE" });
      router.push("/dashboard/packages");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function addOffer() {
    if (!offerLabel.trim() || !offerExpires.trim() || !offerPrice.trim()) {
      setError("Offer label, expires and price are required.");
      return;
    }
    const priceCents = Math.round(Number(offerPrice) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Invalid price.");
      return;
    }
    const d = new Date(offerExpires);
    if (Number.isNaN(d.getTime())) {
      setError("Invalid expires date.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create_offer",
          label: offerLabel.trim(),
          expires_at: d.toISOString(),
          price_cents: priceCents,
          currency: offerCurrency.trim() || "EGP",
        }),
      })) as { offer: OfferRow };
      setOffers((prev) => [...prev, json.offer].sort((a, b) => a.expires_at.localeCompare(b.expires_at)));
      setOfferLabel("");
      setOfferExpires("");
      setOfferPrice("");
      setOfferCurrency("EGP");
      setOfferOpen(false);
      setMessage("Offer added.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateOffer(offerId: string, patch: Partial<OfferRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_offer", offer_id: offerId, ...patch }),
      })) as { offer: OfferRow };
      setOffers((prev) => prev.map((o) => (o.id === offerId ? json.offer : o)));
      setMessage("Offer updated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOffer(offerId: string) {
    const ok = window.confirm("Delete this offer?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_offer", offer_id: offerId }),
      });
      setOffers((prev) => prev.filter((o) => o.id !== offerId));
      setMessage("Offer deleted.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAssets(files: File[]) {
    if (!files.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const baseSort = assets.length === 0 ? 0 : Math.max(...assets.map((a) => a.sort_order ?? 0)) + 1;
      
      const uploadPromises = files.map(async (file, i) => {
        const safeName = file.name.replaceAll(" ", "-");
        const path = `subjects/${subjectId}/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
        
        const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_asset",
            bucket: storageBucket,
            storage_path: path,
            url: publicUrl,
            alt: file.name,
            sort_order: baseSort + i,
          }),
        })) as { asset: SubjectAssetRow };
        return json.asset;
      });

      const newAssets = await Promise.all(uploadPromises);
      setAssets((prev) => [...prev, ...newAssets]);
      setAssetFiles([]);
      setMessage("Gallery updated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateAsset(assetId: string, patch: Partial<SubjectAssetRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_asset", asset_id: assetId, ...patch }),
      })) as { asset: SubjectAssetRow };
      setAssets((prev) => prev.map((a) => (a.id === assetId ? json.asset : a)));
      setMessage("Asset updated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(assetId: string) {
    const ok = window.confirm("Delete this asset?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_asset", asset_id: assetId }),
      });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      setMessage("Asset deleted.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const headerSubtitle = useMemo(() => subject?.title ?? subjectId, [subject?.title, subjectId]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Package
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Package Details
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">{headerSubtitle}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={deleteSubject}
              disabled={saving}
              className="bg-white text-rose-700 border border-rose-200 px-6 py-3 font-bold text-sm hover:bg-rose-50 transition-all disabled:opacity-60"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={saveSubject}
              disabled={saving}
              className="bg-secondary text-white px-6 py-3 font-bold text-sm hover:bg-primary transition-all disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      {message ? (
        <div className="p-6 border-b border-outline/40 bg-surface-variant text-on-surface">{message}</div>
      ) : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Slug</div>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Track</div>
              <input
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Short description (card)
              </div>
              <input
                value={cardDescription}
                onChange={(e) => setCardDescription(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Long description (details page)
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors resize-none"
              />
            </div>

            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Gallery upload
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setAssetFiles(Array.from(e.target.files ?? []))}
                className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => uploadAssets(assetFiles)}
                disabled={saving || assetFiles.length === 0}
                className="mt-3 h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Upload images
              </button>
              <div className="text-xs text-on-surface-variant font-medium mt-2">
                Bucket: {storageBucket}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-5 border-b border-outline/40 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">Offers</div>
                <button
                  type="button"
                  onClick={() => {
                    setOfferLabel("");
                    setOfferExpires("");
                    setOfferPrice("");
                    setOfferCurrency("EGP");
                    setOfferOpen(true);
                  }}
                  className="h-10 px-4 bg-secondary text-white font-bold text-xs hover:bg-primary transition-colors"
                >
                  Add offer
                </button>
              </div>
              {offers.length === 0 ? (
                <div className="p-6 text-on-surface-variant font-medium">No offers yet.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-variant">
                      <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                        <th className="px-5 py-3">Label</th>
                        <th className="px-5 py-3">Expires</th>
                        <th className="px-5 py-3">Price</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {offers.map((o) => (
                        <tr key={o.id} className="border-t border-outline/40">
                          <td className="px-5 py-4">
                            <input
                              defaultValue={o.label}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== o.label) updateOffer(o.id, { label: v });
                              }}
                              className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                            />
                          </td>
                          <td className="px-5 py-4">
                            <input
                              type="date"
                              defaultValue={o.expires_at.slice(0, 10)}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (!v) return;
                                const d = new Date(v);
                                if (Number.isNaN(d.getTime())) return;
                                const iso = d.toISOString();
                                if (iso !== o.expires_at) updateOffer(o.id, { expires_at: iso });
                              }}
                              className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                            />
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <input
                                defaultValue={(o.price_cents / 100).toFixed(2)}
                                onBlur={(e) => {
                                  const n = Number(e.target.value);
                                  if (!Number.isFinite(n)) return;
                                  const cents = Math.round(n * 100);
                                  if (cents !== o.price_cents) updateOffer(o.id, { price_cents: cents });
                                }}
                                className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                              />
                              <input
                                defaultValue={o.currency}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== o.currency) updateOffer(o.id, { currency: v });
                                }}
                                className="h-10 w-20 px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                              />
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => deleteOffer(o.id)}
                              disabled={saving}
                              className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-5 border-b border-outline/40">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Promo images
                </div>
              </div>
              {assets.length === 0 ? (
                <div className="p-6 text-on-surface-variant font-medium">No images yet.</div>
              ) : (
                <div className="divide-y divide-outline/40">
                  {assets
                    .slice()
                    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
                    .map((a) => (
                      <div key={a.id} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            {a.url ? (
                              <img
                                src={a.url}
                                alt={a.alt || a.storage_path || "Promo image"}
                                className="h-24 w-full max-w-[360px] object-cover border border-outline/40"
                              />
                            ) : null}
                            <div className="text-sm font-extrabold text-primary break-all">
                              {a.url || a.storage_path || a.id}
                            </div>
                            <div className="text-xs text-on-surface-variant font-medium mt-1">
                              Sort: {a.sort_order} • Bucket: {a.bucket}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteAsset(a.id)}
                            disabled={saving}
                            className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                          <div className="md:col-span-7">
                            <input
                              defaultValue={a.url ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (a.url ?? "")) updateAsset(a.id, { url: v || null });
                              }}
                              placeholder="URL"
                              className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <input
                              defaultValue={a.alt ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (a.alt ?? "")) updateAsset(a.id, { alt: v || null });
                              }}
                              placeholder="Alt"
                              className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <input
                              defaultValue={String(a.sort_order)}
                              onBlur={(e) => {
                                const n = Math.trunc(Number(e.target.value));
                                if (!Number.isFinite(n)) return;
                                if (n !== a.sort_order) updateAsset(a.id, { sort_order: n });
                              }}
                              placeholder="Sort"
                              className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {offerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            onClick={() => setOfferOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-xl bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between gap-4">
              <div className="text-sm font-extrabold text-primary">Add offer</div>
              <button
                type="button"
                onClick={() => setOfferOpen(false)}
                className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Label</div>
                <input
                  value={offerLabel}
                  onChange={(e) => setOfferLabel(e.target.value)}
                  placeholder="1 Month"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Expires</div>
                <input
                  value={offerExpires}
                  onChange={(e) => setOfferExpires(e.target.value)}
                  type="date"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Price</div>
                  <input
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder="399"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Currency</div>
                  <input
                    value={offerCurrency}
                    onChange={(e) => setOfferCurrency(e.target.value)}
                    placeholder="EGP"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="text-xs text-on-surface-variant font-medium">
                Price is entered in major units (e.g. 399 = 399 EGP).
              </div>
              <button
                type="button"
                onClick={addOffer}
                disabled={saving}
                className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Add offer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
