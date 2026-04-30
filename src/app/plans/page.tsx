import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import PlansSection from "../PlansSection";

export const metadata = {
  title: "Plans & Packages — 800 Academy",
  description: "Browse all available exam preparation packages and choose the best plan for your EST journey.",
};

export default function PlansPage() {
  return (
    <>
      <div className="max-w-[1440px] mx-auto px-8 lg:px-12 pt-8">
        <div className="flex items-center justify-between gap-6">
          <BackButton fallbackHref="/" />
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Plans" }]} />
        </div>
      </div>
      <PlansSection />
    </>
  );
}
