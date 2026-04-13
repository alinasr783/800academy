"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        try {
          router.back();
        } catch {
          router.push(fallbackHref);
        }
      }}
      className="inline-flex items-center gap-2 bg-white text-primary border border-outline px-4 py-2.5 font-bold text-sm hover:bg-surface-variant transition-all rounded-full"
    >
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
      Back
    </button>
  );
}

