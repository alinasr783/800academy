export default function DashboardHome() {
  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl p-10">
      <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
        Overview
      </div>
      <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tighter">
        Dashboard
      </h1>
      <p className="text-on-surface-variant font-medium mt-4">
        Manage users, subscriptions, packages, and exams.
      </p>
    </div>
  );
}

