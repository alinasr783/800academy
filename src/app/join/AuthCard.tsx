"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "login" | "signup";

type Props = {
  mode: Mode;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function friendlyAuthError(message: string) {
  const msg = message.toLowerCase();
  if (msg.includes("user already registered") || msg.includes("already registered")) {
    return "This email is already registered.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (msg.includes("password") && msg.includes("should be at least")) {
    return "Password is too short.";
  }
  if (msg.includes("email") && msg.includes("invalid")) {
    return "Invalid email address.";
  }
  return message;
}

export default function AuthCard({ mode }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buttonLabel = useMemo(() => {
    if (loading) return "Please wait…";
    return mode === "login" ? "Log in" : "Create Account";
  }, [loading, mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email.");
      return;
    }

    const pass = password;
    if (!pass || pass.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup") {
      const hasLetter = /[A-Za-z]/.test(pass);
      const hasNumber = /\d/.test(pass);
      if (!hasLetter || !hasNumber) {
        setError("Password must include at least 1 letter and 1 number.");
        return;
      }
    }

    setLoading(true);
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      const target = next || "/profile";

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: pass,
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setError(
            "Email confirmation is enabled. Disable Confirm email in Supabase Auth to sign up without confirmation.",
          );
        } else {
          router.push(target);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: pass,
        });
        if (signInError) throw signInError;
        router.push(target);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(friendlyAuthError(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-on-surface">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder={mode === "login" ? "anna@gmail.com" : "name@example.com"}
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-on-surface">
            {mode === "login" ? "Password" : "Create Your Password For Next Times"}
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-12 w-full pr-10 px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-normal cursor-pointer select-none text-on-surface-variant">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-4 accent-primary"
            />
            Remember for 30 days
          </label>
        </div>

        {error ? (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="p-3 text-sm text-on-surface bg-surface-variant border border-border/60">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          className="w-full h-12 text-base font-medium bg-primary text-white hover:bg-slate-800 transition-colors disabled:opacity-60"
          disabled={loading}
        >
          {buttonLabel}
        </button>
      </form>

      <div className="text-center text-sm text-muted-foreground mt-8">
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <Link
          href={mode === "login" ? "/join?mode=signup" : "/join?mode=login"}
          className="text-on-surface font-medium hover:underline"
        >
          {mode === "login" ? "Sign Up" : "Log In"}
        </Link>
      </div>
    </>
  );
}
