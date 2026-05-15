"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import { signup } from "@/features/auth/auth-api";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Founder");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  const signupMutation = useMutation({
    mutationFn: signup,
    onSuccess: async () => {
      setErrorMsg("");
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/dashboard");
    },
    onError: (err) => {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string } | undefined)?.message ||
          err.response?.statusText ||
          err.message
        : err instanceof Error
          ? err.message
          : "Sign up failed";
      setErrorMsg(typeof msg === "string" ? msg : "Sign up failed");
    }
  });

  return (
    <main className="relative min-h-screen grid place-items-center p-6">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-gold/25 bg-surface-card shadow-gold p-6 space-y-4">
        <h1 className="text-2xl font-semibold text-gold-bright">Create account</h1>
        <p className="text-sm text-muted">Start your FounderOS workspace</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMsg("");
            signupMutation.mutate({ name, email, password, role });
          }}
        >
          {errorMsg ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {errorMsg}
            </p>
          ) : null}
          <input className="w-full rounded-lg border border-gold/15 bg-surface-input px-3 py-2 text-ink placeholder:text-muted focus:border-gold/40 focus:outline-none" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full rounded-lg border border-gold/15 bg-surface-input px-3 py-2 text-ink placeholder:text-muted focus:border-gold/40 focus:outline-none" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-full rounded-lg border border-gold/15 bg-surface-input px-3 py-2 text-ink placeholder:text-muted focus:border-gold/40 focus:outline-none" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="w-full rounded-lg border border-gold/15 bg-surface-input px-3 py-2 text-ink focus:border-gold/40 focus:outline-none" value={role} onChange={(e) => setRole(e.target.value)}>
            {["Founder", "CEO", "HR", "Finance", "Sales", "Operations", "Employee"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="w-full rounded-lg bg-gold-cta py-2 font-semibold shadow-gold hover:brightness-110" disabled={signupMutation.isPending}>
            {signupMutation.isPending ? "Creating..." : "Sign up"}
          </button>
        </form>
      </div>
    </main>
  );
}

