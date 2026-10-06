import React from "react";
import Link from "next/link";
import { Sparkles, Cpu, Database, Network } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-zinc-800/80 bg-zinc-950 text-zinc-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Venture<span className="text-cyan-400">X</span>
              </span>
            </div>
            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              AI-powered ecosystem connecting high-potential founders with top-tier venture capital,
              syndicates, and angel investors through explainable semantic matching.
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500 pt-2 font-mono">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-400" /> FastAPI + PyTorch Ready
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-400" /> PostgreSQL + pgvector
              </span>
            </div>
          </div>

          {/* Platform Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/founder/dashboard" className="hover:text-white transition-colors">
                  Founder Dashboard
                </Link>
              </li>
              <li>
                <Link href="/investor/dashboard" className="hover:text-white transition-colors">
                  Investor Portal
                </Link>
              </li>
              <li>
                <Link href="/founder/projects/new" className="hover:text-white transition-colors">
                  Submit Pitch & Project
                </Link>
              </li>
              <li>
                <Link href="/investor/preferences" className="hover:text-white transition-colors">
                  Match Criteria Setup
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture & Stack */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Architecture</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>• Modular Monolith (FastAPI)</li>
              <li>• Next.js App Router & Tailwind CSS</li>
              <li>• Future Sentence Transformers</li>
              <li>• Docker & Docker Compose</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} Venture X. Scalable AI/ML Capstone Architecture.</p>
          <div className="flex gap-6">
            <span>API: <code className="text-zinc-400 font-mono">/api/health</code></span>
            <span>Docs: <code className="text-zinc-400 font-mono">/docs</code></span>
          </div>
        </div>
      </div>
    </footer>
  );
}
