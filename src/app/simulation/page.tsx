import SimulationClient from "./SimulationClient";

export const metadata = {
  title: "Simulation EST | 800 Academy",
  description: "Take full-length EST simulation exams categorized by subject.",
};

export default function SimulationPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SimulationClient />
    </div>
  );
}
