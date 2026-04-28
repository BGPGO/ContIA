"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";

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
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        className="bg-gradient-to-br from-bg-input to-bg-card border border-border/60 rounded-xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(78,205,196,0.08)] relative overflow-hidden"
      >
        {/* Ambient glow orbs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-[#4ecdc4]/10 to-[#6c5ce7]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-gradient-to-br from-[#6c5ce7]/8 to-transparent blur-3xl pointer-events-none" />

        <div className="w-12 h-12 rounded-full bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(78,205,196,0.2)]">
          <Sparkles className="w-5 h-5 text-[#4ecdc4]" />
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
          className="text-sm text-[#4ecdc4] hover:text-[#6ee7de] transition-colors"
        >
          Voltar ao login
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="bg-gradient-to-br from-bg-input to-bg-card border border-border/60 rounded-xl p-8 max-w-sm w-full shadow-[0_0_40px_rgba(78,205,196,0.08)] relative overflow-hidden"
    >
      {/* Ambient glow orbs */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br from-[#4ecdc4]/10 to-[#6c5ce7]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-gradient-to-br from-[#6c5ce7]/8 to-transparent blur-3xl pointer-events-none" />

      {/* Brand */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center gap-2.5 mb-8"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4ecdc4] to-[#2db6a0] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-text-primary">
          ContIA
        </span>
      </motion.div>

      <h1 className="text-xl font-semibold text-text-primary mb-1">
        Criar conta
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Comece a usar o ContIA gratuitamente
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex flex-col gap-1.5"
        >
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
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-[#4ecdc4] focus:ring-2 focus:ring-[#4ecdc4]/20 outline-none transition-all duration-200 placeholder:text-text-muted"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="flex flex-col gap-1.5"
        >
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
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-[#4ecdc4] focus:ring-2 focus:ring-[#4ecdc4]/20 outline-none transition-all duration-200 placeholder:text-text-muted"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="flex flex-col gap-1.5"
        >
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
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-[#4ecdc4] focus:ring-2 focus:ring-[#4ecdc4]/20 outline-none transition-all duration-200 placeholder:text-text-muted"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.3 }}
          className="flex flex-col gap-1.5"
        >
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
            className="bg-bg-input border border-border text-text-primary rounded-lg h-10 px-3 text-sm focus:border-[#4ecdc4] focus:ring-2 focus:ring-[#4ecdc4]/20 outline-none transition-all duration-200 placeholder:text-text-muted"
          />
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          <motion.button
            type="submit"
            disabled={loading}
            whileTap={!loading ? { scale: 0.98 } : undefined}
            whileHover={!loading ? { scale: 1.02 } : undefined}
            className="w-full h-10 bg-gradient-to-r from-[#6c5ce7] to-[#4ecdc4] hover:shadow-[0_0_25px_rgba(78,205,196,0.3)] hover:-translate-y-0.5 text-white text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </motion.button>
        </motion.div>
      </form>

      <p className="text-xs text-text-secondary text-center mt-6">
        Já tem conta?{" "}
        <Link href="/login" className="text-[#4ecdc4] hover:text-[#6ee7de] transition-colors">
          Entrar
        </Link>
      </p>
    </motion.div>
  );
}
