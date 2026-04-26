"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  const [marketingTitle, setMarketingTitle] = useState("");
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
      setMarketingTitle(json.subject.marketing_title ?? "");
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
          marketing_title: marketingTitle.trim() || null,
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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  async function reorderAssets(newAssets: SubjectAssetRow[]) {
    setAssets(newAssets);
    setSaving(true);
    try {
      // Update all sort orders in DB
      await Promise.all(
        newAssets.map((asset, index) =>
          adminFetch(`/api/admin/packages/${subjectId}`, {
            method: "POST",
            body: JSON.stringify({ 
              action: "update_asset", 
              asset_id: asset.id, 
              sort_order: asset.sort_order === -1 ? -1 : index 
            }),
          })
        )
      );
      setMessage("Order saved.");
    } catch (e) {
      setError("Failed to save order.");
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(index: number) {
    if (draggedIndex === null || draggedIndex === index) return;
    const newAssets = [...assets].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const [movedItem] = newAssets.splice(draggedIndex, 1);
    newAssets.splice(index, 0, movedItem);
    
    // Recalculate sort_order while preserving -1 for primary
    const reordered = newAssets.map((item, idx) => ({
      ...item,
      sort_order: item.sort_order === -1 ? -1 : idx
    }));
    
    reorderAssets(reordered);
    setDraggedIndex(null);
  }

  async function setAssetAsPrimary(assetId: string) {
    setSaving(true);
    setError(null);
    try {
      const currentPrimary = assets.find(a => a.sort_order === -1);
      if (currentPrimary) {
        await adminFetch(`/api/admin/packages/${subjectId}`, {
          method: "POST",
          body: JSON.stringify({ action: "update_asset", asset_id: currentPrimary.id, sort_order: 0 }),
        });
      }
      const json = (await adminFetch(`/api/admin/packages/${subjectId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_asset", asset_id: assetId, sort_order: -1 }),
      })) as { asset: SubjectAssetRow };
      
      setAssets((prev) => 
        prev.map((a) => {
          if (a.id === assetId) return json.asset;
          if (currentPrimary && a.id === currentPrimary.id) return { ...a, sort_order: 0 };
          return a;
        })
      );
      setMessage("Card image updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
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
        <div className="p-8 space-y-10">
          {/* Main Details */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  Marketing Title <span className="text-on-surface-variant font-medium normal-case tracking-normal">(shown on subject page instead of title)</span>
                </div>
                <input
                  value={marketingTitle}
                  onChange={(e) => setMarketingTitle(e.target.value)}
                  placeholder="e.g. Master Math EST 1 — Your Path to 800"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
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
          </div>

          {/* Offers Section */}
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
              <div className="p-12 text-center text-on-surface-variant font-medium text-sm">No offers created yet.</div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-variant border-b border-outline/40">
                    <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                      <th className="px-5 py-4">Label</th>
                      <th className="px-5 py-4">Expires</th>
                      <th className="px-5 py-4">Price</th>
                      <th className="px-5 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((o) => (
                      <tr key={o.id} className="border-t border-outline/40 hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4">
                          <input
                            defaultValue={o.label}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== o.label) updateOffer(o.id, { label: v });
                            }}
                            className="h-10 w-full px-3 bg-white border border-border/60 focus:border-primary outline-none transition-colors text-sm font-bold"
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
                            className="h-10 w-full px-3 bg-white border border-border/60 focus:border-primary outline-none transition-colors text-sm"
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
                              className="h-10 w-full px-3 bg-white border border-border/60 focus:border-primary outline-none transition-colors text-sm font-bold"
                            />
                            <input
                              defaultValue={o.currency}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== o.currency) updateOffer(o.id, { currency: v });
                              }}
                              className="h-10 w-20 px-3 bg-white border border-border/60 focus:border-primary outline-none transition-colors text-sm"
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

          {/* Package Images Section */}
          <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
            <div className="p-5 border-b border-outline/40 flex items-center justify-between">
              <div className="text-xs font-bold text-primary uppercase tracking-widest">
                Package Images <span className="text-[10px] lowercase tracking-normal font-medium text-on-surface-variant/60 ml-2">(Drag to reorder)</span>
              </div>
              <div className="flex items-center gap-3">
                 <label className="h-8 px-4 bg-primary text-white font-bold text-[10px] uppercase tracking-widest rounded flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-all">
                    + Upload
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files) uploadAssets(Array.from(e.target.files));
                      }}
                    />
                 </label>
              </div>
            </div>
            {assets.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant font-medium text-sm">
                No images uploaded for this package.
              </div>
            ) : (
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {assets
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
                  .map((a, idx) => {
                    const isPrimary = a.sort_order === -1;
                    return (
                      <div 
                        key={a.id} 
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(idx)}
                        className={`relative group aspect-video bg-slate-100 border-2 transition-all cursor-move overflow-hidden rounded-lg ${isPrimary ? "border-primary shadow-lg scale-[1.02] z-10" : "border-outline/30 hover:border-primary/50"} ${draggedIndex === idx ? "opacity-30" : "opacity-100"}`}
                      >
                        {a.url ? (
                          <img
                            src={a.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-400">image</span>
                          </div>
                        )}

                        {/* Badges */}
                        {isPrimary && (
                          <div className="absolute top-2 left-2 bg-primary text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 shadow-md rounded">
                            Card Cover
                          </div>
                        )}

                        {/* Hover Actions */}
                        <div className="absolute inset-0 bg-primary/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-4">
                           {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => setAssetAsPrimary(a.id)}
                                disabled={saving}
                                className="w-full py-2 bg-white text-primary font-bold text-[9px] uppercase tracking-widest rounded hover:bg-slate-100 transition-colors disabled:opacity-50"
                              >
                                Set as Card Cover
                              </button>
                           )}
                           <button
                             type="button"
                             onClick={() => deleteAsset(a.id)}
                             disabled={saving}
                             className="w-full py-2 bg-rose-600 text-white font-bold text-[9px] uppercase tracking-widest rounded hover:bg-rose-700 transition-colors disabled:opacity-50"
                           >
                             Delete Image
                           </button>
                        </div>

                        {/* Order Indicator */}
                        <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded border border-white/10 pointer-events-none group-hover:opacity-0 transition-opacity">
                           {isPrimary ? "Primary" : `#${idx + 1}`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
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
