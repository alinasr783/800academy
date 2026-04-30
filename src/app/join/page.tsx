import AuthCard from "./AuthCard";
import LoginHero from "./LoginHero";

export const metadata = {
  title: "Join The Academy",
};

type Mode = "login" | "signup";

function normalizeMode(value: string | string[] | undefined): Mode {
  if (value === "login") return "login";
  return "signup";
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const mode = normalizeMode((await searchParams).mode);

  return (
    <div className="h-screen bg-background overflow-hidden">
      <div className="h-full grid lg:grid-cols-2">
        <LoginHero />
        <div className="flex items-center justify-center p-8 bg-background">
          <div className="w-full max-w-[420px]">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-tight mb-2 font-headline text-on-surface">
                {mode === "login" ? "Welcome back!" : "Join the Academy"}
              </h1>
              <p className="text-on-surface-variant text-sm">
                {mode === "login"
                  ? "Please enter your details"
                  : "Create your account to begin"}
              </p>
            </div>
            <AuthCard mode={mode} />
          </div>
        </div>
      </div>
    </div>
  );
}
