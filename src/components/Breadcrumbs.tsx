import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {items.map((it, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div key={`${it.label}-${idx}`} className="flex items-center gap-2">
            {idx > 0 ? (
              <span className="text-on-surface-variant font-black text-[10px] uppercase tracking-[0.2em]">
                /
              </span>
            ) : null}
            {it.href && !isLast ? (
              <Link
                href={it.href}
                className="text-on-surface-variant font-black text-[10px] uppercase tracking-[0.2em] hover:text-primary transition-colors"
              >
                {it.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? "text-primary font-black text-[10px] uppercase tracking-[0.2em]"
                    : "text-on-surface-variant font-black text-[10px] uppercase tracking-[0.2em]"
                }
              >
                {it.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

