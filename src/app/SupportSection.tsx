"use client";

export default function SupportSection() {
  const whatsappHref =
    "https://wa.me/201158954215?text=" +
    encodeURIComponent("I came from 800 Academy and I need help with my questions.");

  return (
    <section className="py-24 px-8 lg:px-12 bg-white relative overflow-hidden">
      {/* Subtle decorative element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto relative z-10">
        <div className="bg-slate-50 border border-outline/40 rounded-[2.5rem] p-10 sm:p-16 text-center max-w-4xl mx-auto shadow-soft-xl group hover:border-primary/20 transition-all duration-500">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 group-hover:bg-primary transition-all duration-500">
            <span className="material-symbols-outlined text-primary text-3xl group-hover:text-white transition-colors">
              support_agent
            </span>
          </div>

          <h2 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-black text-primary mb-6 tracking-tight">
            Didn&apos;t find your question here?
          </h2>

          <p className="text-on-surface-variant text-base sm:text-lg font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            Our support team is waiting for you... <span className="text-secondary font-bold">24/7</span>. 
            Speak with us now and get all the answers you need in no time.
          </p>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 bg-primary text-white px-10 py-5 rounded-2xl font-bold text-lg hover:bg-slate-800 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">chat</span>
            Chat with Support
          </a>
        </div>
      </div>
    </section>
  );
}
