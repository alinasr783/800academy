"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SubjectRow = {
  id: string;
  slug: string;
  title: string;
  track: string | null;
  card_description: string | null;
  description: string | null;
  created_at: string;
};

export default function DashboardPackages() {
  const router = useRouter();
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SubjectRow[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTrack, setNewTrack] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);

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
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.push("/join?mode=login");
        setRows([]);
        setCount(0);
        return;
      }

      const url = new URL("/api/admin/packages", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json().catch(() => ({}))) as { items?: SubjectRow[]; count?: number; error?: string };
      if (!res.ok) {
        setError(json.error ?? (res.status === 403 ? "Not authorized." : "Request failed."));
        setRows([]);
        setCount(0);
        return;
      }
      setRows(json.items ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createSubject() {
    if (
      !newSlug.trim() ||
      !newTitle.trim() ||
      !newTrack.trim() ||
      !newCardDescription.trim() ||
      !newDescription.trim()
    ) {
      setError("All fields are required.");
      return;
    }
    if (newGalleryFiles.length === 0) {
      setError("Gallery is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const json = (await adminFetch("/api/admin/packages", {
        method: "POST",
        body: JSON.stringify({
          slug: newSlug.trim(),
          title: newTitle.trim(),
          track: newTrack.trim(),
          card_description: newCardDescription.trim(),
          description: newDescription.trim(),
        }),
      })) as { subject: SubjectRow };

      const subjectId = json.subject.id;

      for (let i = 0; i < newGalleryFiles.length; i++) {
        const file = newGalleryFiles[i]!;
        const safeName = file.name.replaceAll(" ", "-");
        const path = `subjects/${subjectId}/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, {
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);

        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
        await adminFetch(`/api/admin/packages/${subjectId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_asset",
            bucket: storageBucket,
            storage_path: path,
            url: publicUrl,
            alt: file.name,
            sort_order: i,
          }),
        });
      }

      setNewSlug("");
      setNewTitle("");
      setNewTrack("");
      setNewCardDescription("");
      setNewDescription("");
      setNewGalleryFiles([]);
      setCreateOpen(false);
      router.push(`/dashboard/packages/${subjectId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => rows.length, [rows]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Packages
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Plans Management
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              Total: {count} • Shown: {shown}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by slug/title/track"
              className="h-12 w-[320px] max-w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
            />
            <button
              type="button"
              onClick={load}
              className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setNewSlug("");
                setNewTitle("");
                setNewTrack("");
                setNewCardDescription("");
                setNewDescription("");
                setNewGalleryFiles([]);
                setCreateOpen(true);
              }}
              className="h-12 px-6 bg-secondary text-white font-bold text-sm hover:bg-primary transition-colors"
            >
              New Plan
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            onClick={() => setCreateOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-3xl bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between gap-4">
              <div className="text-sm font-extrabold text-primary">Create plan</div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                Close
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Slug</div>
                  <input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="sat-digital-math"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-8">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Name</div>
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="SAT Digital Math"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Track</div>
                  <input
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value)}
                    placeholder="EST 1"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-6">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                    Short description (card)
                  </div>
                  <input
                    value={newCardDescription}
                    onChange={(e) => setNewCardDescription(e.target.value)}
                    placeholder="Shown on landing cards"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Long description (details page)
                </div>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={7}
                  className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Gallery</div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setNewGalleryFiles(Array.from(e.target.files ?? []))}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
                <div className="text-xs text-on-surface-variant font-medium mt-2">
                  Uploads to Storage bucket: {storageBucket}
                </div>
              </div>

              <button
                type="button"
                onClick={createSubject}
                disabled={creating}
                className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Create plan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Track</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-outline/40">
                  <td className="px-6 py-5">
                    <div className="text-sm font-extrabold text-primary">{r.title}</div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">{r.slug}</div>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                    {r.track || "—"}
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/dashboard/packages/${r.id}`}
                      className="text-sm font-bold text-primary hover:text-secondary transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
