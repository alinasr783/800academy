import LessonsClient from "./LessonsClient";

export const metadata = {
  title: "Topic Lessons | 800 Academy",
  description: "Master each topic with structured lessons and practice questions.",
};

export default function LessonsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LessonsClient />
    </div>
  );
}
