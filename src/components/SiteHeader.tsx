import Image from "next/image";
import Link from "next/link";
import logo from "@/app/logo.png";
import HeaderAuthActions from "@/components/HeaderAuthActions";

type Props = {
  active?: "home" | "plans" | "benefits" | "contact";
};

export default function SiteHeader({ active }: Props) {
  return (
    <nav className="fixed top-0 w-full z-50 nav-blur shadow-sm">
      <div className="flex justify-between items-center px-8 py-5 max-w-7xl mx-auto">
        <Link className="flex items-center gap-4" href="/#home">
          <Image src={logo} alt="800 Academy" className="h-10 w-auto" priority />
        </Link>
        <div className="hidden md:flex gap-10 items-center font-bold text-sm tracking-wide">
          <a
            className={
              active === "home"
                ? "text-secondary border-b-2 border-secondary pb-1"
                : "text-on-surface hover:text-secondary transition-all"
            }
            href="/#home"
          >
            Home
          </a>
          <a
            className={
              active === "plans"
                ? "text-secondary border-b-2 border-secondary pb-1"
                : "text-on-surface hover:text-secondary transition-all"
            }
            href="/#plans"
          >
            Plans
          </a>
          <a
            className={
              active === "benefits"
                ? "text-secondary border-b-2 border-secondary pb-1"
                : "text-on-surface hover:text-secondary transition-all"
            }
            href="/#benefits"
          >
            Benefits
          </a>
          <a
            className={
              active === "contact"
                ? "text-secondary border-b-2 border-secondary pb-1"
                : "text-on-surface hover:text-secondary transition-all"
            }
            href="/#contact"
          >
            Contact
          </a>
        </div>
        <HeaderAuthActions />
      </div>
    </nav>
  );
}
