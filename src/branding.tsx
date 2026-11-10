import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandSettings {
  brand_name: string;
  tagline: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  footer_text: string;
}

const DEFAULT_BRANDING: BrandSettings = {
  brand_name: "",
  tagline: "",
  logo_url: "",
  primary_color: "#172033",
  accent_color: "#64748b",
  footer_text: "",
};

const BrandingContext = createContext<BrandSettings>(DEFAULT_BRANDING);

function safeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings>(DEFAULT_BRANDING);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("app_branding")
          .select("brand_name,tagline,logo_url,primary_color,accent_color,footer_text")
          .eq("singleton", true)
          .maybeSingle();
        if (error || !data || !active) return;
        setBrand({
          brand_name: typeof data.brand_name === "string" ? data.brand_name : "",
          tagline: typeof data.tagline === "string" ? data.tagline : "",
          logo_url: typeof data.logo_url === "string" ? data.logo_url : "",
          primary_color: safeHex(data.primary_color, DEFAULT_BRANDING.primary_color),
          accent_color: safeHex(data.accent_color, DEFAULT_BRANDING.accent_color),
          footer_text: typeof data.footer_text === "string" ? data.footer_text : "",
        });
      } catch {
        // Keep the neutral defaults when branding storage is not configured.
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", brand.primary_color);
    document.documentElement.style.setProperty("--brand-accent", brand.accent_color);
    document.title = brand.brand_name.trim() || "Market Analysis Terminal";
  }, [brand]);

  return <BrandingContext.Provider value={brand}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandSettings {
  return useContext(BrandingContext);
}
