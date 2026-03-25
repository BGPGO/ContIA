"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-5 h-5 text-success" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Verifique seu email
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Enviamos um link de confirmação para <strong className="text-text-primary">{email}</strong>.
          Clique no link para ativar sua conta.
        </p>
        <Link
          href="/login"
          className="text-sm text-accent-light hover:text-accent transition-colors"
        >
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-8 max-w-sm w-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-500 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          ContIA
        </span>
      </div>

      <h1 className="text-xl font-semibold text-text-primary mb-1">
        Criar conta
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Comece a usar o ContIA gratuitamente
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className="text-xs font-medium text-text-secondary">
            Nome
          </label>
          <input
            id="nome"
            type="text"
            autoComplete="name"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors placeholder:text-text-muted"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-text-secondary">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors placeholder:text-text-muted"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-text-secondary">
            Senha
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors placeholder:text-text-muted"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-xs font-medium text-text-secondary">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none transition-colors placeholder:text-text-muted"
          />
        </div>

        {error && (
          <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-accent hover:bg-accent/90 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>
      </form>

      <p className="text-xs text-text-secondary text-center mt-6">
        Já tem conta?{" "}
        <Link href="/login" className="text-accent-light hover:text-accent transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  );
}
