import SiteHeader from "@/components/SiteHeader";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "My Account | 800 Academy",
};

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <main className="pt-20">
        <ProfileClient />
      </main>
    </>
  );
}

