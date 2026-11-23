import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  inviteDeploymentUser,
  listDeploymentUsers,
  setDeploymentUserAccess,
} from "@/lib/api/admin-users.functions";

export const Route = createFileRoute("/admin/users")({ component: DeploymentUsersPage });

type DeploymentUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  banned: boolean;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

function DeploymentUsersPage() {
  const [users, setUsers] = useState<DeploymentUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: auth }, result] = await Promise.all([
        supabase.auth.getUser(),
        listDeploymentUsers(),
      ]);
      setCurrentUserId(auth.user?.id ?? "");
      setUsers(result.users as DeploymentUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kullanıcılar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviting(true);
    setMessage("");
    setError("");
    try {
      const result = await inviteDeploymentUser({ data: { email: email.trim() } });
      setMessage(result.email + " adresine davet gönderildi.");
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Davet gönderilemedi.");
    } finally {
      setInviting(false);
    }
  };

  const toggleAccess = async (user: DeploymentUser) => {
    const enabled = user.banned;
    const action = enabled ? "yeniden açmak" : "kapatmak";
    if (!window.confirm(user.email + " kullanıcısının erişimini " + action + " istediğinizden emin misiniz?")) return;
    setWorkingId(user.id);
    setMessage("");
    setError("");
    try {
      await setDeploymentUserAccess({ data: { userId: user.id, enabled } });
      setMessage(user.email + " erişimi güncellendi.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erişim güncellenemedi.");
    } finally {
      setWorkingId("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-slate-500">Deployment owner</p>
          <h1 className="mt-1 text-2xl font-bold">Kullanıcı ve erişim yönetimi</h1>
          <p className="mt-2 text-sm text-slate-400">Bu liste yalnızca bu kuruluma aittir. En fazla ilk 100 Auth kullanıcısı gösterilir. Yönetici rolleri Supabase sunucu tarafındaki app_metadata üzerinden yönetilir.</p>
        </header>

        <form onSubmit={invite} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row">
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Müşterinin e-posta adresi"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button disabled={inviting} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {inviting ? "Gönderiliyor…" : "Davet gönder"}
          </button>
        </form>

        {message && <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</p>}
        {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <h2 className="font-semibold">Kurulum kullanıcıları</h2>
            <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs disabled:opacity-50">Yenile</button>
          </div>
          {loading ? <p className="p-5 text-sm text-slate-400">Kullanıcılar yükleniyor…</p> :
            users.length === 0 ? <p className="p-5 text-sm text-slate-400">Kullanıcı bulunamadı.</p> :
            <div className="divide-y divide-slate-800">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">{user.email || "E-posta yok"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {user.role === "admin" ? "Yönetici" : "Kullanıcı"} · {user.emailConfirmed ? "E-posta doğrulandı" : "E-posta doğrulanmadı"} · {user.banned ? "Erişim kapalı" : "Erişim açık"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Son giriş: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("tr-TR") : "Henüz giriş yok"}
                    </p>
                  </div>
                  <button
                    disabled={workingId === user.id || user.id === currentUserId}
                    onClick={() => void toggleAccess(user)}
                    className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                    title={user.id === currentUserId ? "Kendi erişiminizi buradan değiştiremezsiniz" : ""}
                  >
                    {workingId === user.id ? "İşleniyor…" : user.banned ? "Erişimi aç" : "Erişimi kapat"}
                  </button>
                </div>
              ))}
            </div>
          }
        </section>
        <p className="text-xs leading-relaxed text-slate-500">Not: Bu ekran kullanıcı daveti ve erişim engelleme içindir. Lisans anahtarı, süre/yenileme ve merkezi aktivasyon henüz bu kurulumda bulunmuyor. Bu özellik için ayrı bir lisans sunucusu gerekir.</p>
      </div>
    </main>
  );
}
