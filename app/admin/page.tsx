"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("cubex-auth");
    if (!raw) { router.push("/"); return; }
    try {
      const p = JSON.parse(raw);
      fetch("http://localhost:8000/auth/me", { headers: { Authorization: "Bearer " + p.token } })
        .then(r => r.json()).then(d => { setUser(d); setLoading(false); })
        .catch(() => setLoading(false));
    } catch { router.push("/"); }
  }, []);

  if (loading) return <div className="p-8 text-zinc-400">Loading...</div>;
  if (!user) return <div className="p-8 text-zinc-400">Not authenticated</div>;

  const roleText = user.role === "owner" ? t("admin.owner") : t("admin.member");
  const statusColor = user.status === "active" ? "text-green-400" : "text-red-400";
  const statusText = user.status === "active" ? t("admin.active") : t("admin.disabled");

  return (
    <div className="min-h-screen bg-[#0a0a10] text-zinc-200 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">{t("admin.title")}</h1>
          <button onClick={() => router.push("/")} className="text-sm text-zinc-400 hover:text-white">
            ← {t("admin.backToWork")}
          </button>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{t("admin.welcome")}, {user.email}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">{t("admin.role")}</div>
              <div className="text-lg font-semibold text-blue-400">{roleText}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">{t("admin.status")}</div>
              <div className={"text-lg font-semibold " + statusColor}>{statusText}</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 col-span-2">
              <div className="text-xs text-zinc-500 mb-1">{t("admin.email")}</div>
              <div className="text-sm text-zinc-300">{user.email}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
