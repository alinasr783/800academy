import { Metadata } from "next";
import { Suspense } from "react";
import BrainGymClient from "./BrainGymClient";

export const metadata: Metadata = {
  title: "Question Bank Session | 800 Academy",
  description: "Customized practice session to master your topics.",
};

export default function BrainGymPage() {
  return (
    <Suspense fallback={
      <div className="flex bg-white min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <div className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">Initializing Gym...</div>
        </div>
      </div>
    }>
      <BrainGymClient />
    </Suspense>
  );
}
