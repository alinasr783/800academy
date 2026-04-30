import SiteHeader from "@/components/SiteHeader";
import SimulationClient from "./SimulationClient";

export const metadata = {
  title: "Simulation EST | 800 Academy",
  description: "Take full-length EST simulation exams categorized by subject.",
};

export default function SimulationPage() {
  return (
    <>
      <SiteHeader />
      <main className="pt-24 min-h-screen bg-slate-50">
        <SimulationClient />
      </main>
    </>
  );
}
