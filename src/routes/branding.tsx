import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "../branding";

export const Route = createFileRoute("/branding")({ component: BrandingSettingsPage });

const INITIAL = {
  brand_name: "",
  tagline: "",
  logo_url: "",
  primary_color: "#172033",
  accent_color: "#64748b",
  footer_text: "",
};

function BrandingSettingsPage() {
  const navigate = useNavigate();
  const current = useBranding();
  const [form, setForm] = useState(INITIAL);
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [logo, setLogo] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      const isAdmin = !error && data.user?.app_metadata?.role === "admin";
      setAuthorized(isAdmin);
      setChecking(false);
      if (!isAdmin) return;
      const { data: row, error: readError } = await (supabase as any)
        .from("app_branding")
        .select("brand_name,tagline,logo_url,primary_color,accent_color,footer_text")
        .eq("singleton", true)
        .maybeSingle();
      if (!active) return;
      if (readError) {
        setMessage("Marka ayarları okunamadı. Önce alıcı Supabase projesinde WHITE_LABEL_SETUP.md adımlarını uygulayın.");
        return;
      }
      if (row) setForm({
        brand_name: row.brand_name || "",
        tagline: row.tagline || "",
        logo_url: row.logo_url || "",
        primary_color: /^#[0-9a-fA-F]{6}$/.test(row.primary_color || "") ? row.primary_color : INITIAL.primary_color,
        accent_color: /^#[0-9a-fA-F]{6}$/.test(row.accent_color || "") ? row.accent_color : INITIAL.accent_color,
        footer_text: row.footer_text || "",
      });
    };
    void check();
    return () => { active = false; };
  }, []);

  const set = (key: keyof typeof INITIAL, value: string) => setForm(old => ({ ...old, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let logoUrl = form.logo_url.trim();
      if (logo) {
        if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(logo.type) || logo.size > 2 * 1024 * 1024) {
          throw new Error("Logo PNG, JPG, WebP veya SVG olmalı ve 2 MB sınırını aşmamalı.");
        }
        const ext = logo.name.split(".").pop()?.toLowerCase() || "png";
        const path = `brand/logo-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("brand-assets").upload(path, logo, { upsert: true, contentType: logo.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
        logoUrl = data.publicUrl;
      }
      const payload = {
        singleton: true,
        brand_name: form.brand_name.trim(),
        tagline: form.tagline.trim(),
        logo_url: logoUrl,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        footer_text: form.footer_text.trim(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any).from("app_branding").upsert(payload, { onConflict: "singleton" });
      if (error) throw error;
      setMessage("Marka ayarları kaydedildi. Sayfa yenileniyor…");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kaydetme sırasında bilinmeyen bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <main className="min-h-screen bg-slate-950 p-8 text-slate-200">Yetki kontrol ediliyor…</main>;
  if (!authorized) return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-200">
      <section className="mx-auto max-w-lg rounded-xl border border-slate-700 p-6">
        <h1 className="text-xl font-semibold">Erişim reddedildi</h1>
        <p className="mt-2 text-sm text-slate-400">Marka ayarlarını yalnızca bu kurulumun yetkili yöneticisi değiştirebilir.</p>
        <button className="mt-5 rounded-lg bg-slate-700 px-4 py-2" onClick={() => navigate({ to: "/" })}>Ana sayfaya dön</button>
      </section>
    </main>
  );

  const fieldClass = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100";
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <form onSubmit={save} className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-slate-400">Deployment owner</p>
          <h1 className="mt-1 text-2xl font-bold">Marka ayarları</h1>
          <p className="mt-2 text-sm text-slate-400">Bu ayarlar yalnızca bu Supabase kurulumunu etkiler.</p>
        </header>
        <label className="block text-sm">Marka adı<input className={fieldClass} maxLength={60} value={form.brand_name} onChange={e => set("brand_name", e.target.value)} /></label>
        <label className="block text-sm">Slogan<input className={fieldClass} maxLength={120} value={form.tagline} onChange={e => set("tagline", e.target.value)} /></label>
        <label className="block text-sm">Logo dosyası<input className={fieldClass} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => setLogo(e.target.files?.[0] || null)} /><span className="mt-1 block text-xs text-slate-500">PNG, JPG, WebP veya SVG · en fazla 2 MB</span></label>
        <label className="block text-sm">Logo URL (isteğe bağlı)<input className={fieldClass} value={form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://…" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">Ana renk<input className="mt-2 h-11 w-full" type="color" value={form.primary_color} onChange={e => set("primary_color", e.target.value)} /></label>
          <label className="block text-sm">Vurgu rengi<input className="mt-2 h-11 w-full" type="color" value={form.accent_color} onChange={e => set("accent_color", e.target.value)} /></label>
        </div>
        <label className="block text-sm">Alt bilgi metni<input className={fieldClass} maxLength={160} value={form.footer_text} onChange={e => set("footer_text", e.target.value)} /></label>
        {message && <p role="status" className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold disabled:opacity-50" type="submit">{saving ? "Kaydediliyor…" : "Ayarları kaydet"}</button>
          <button className="rounded-lg border border-slate-700 px-5 py-2.5" type="button" onClick={() => navigate({ to: "/" })}>Ana sayfa</button>
        </div>
        {current.logo_url && <p className="text-xs text-slate-500">Mevcut logo: {current.logo_url}</p>}
      </form>
    </main>
  );
}
