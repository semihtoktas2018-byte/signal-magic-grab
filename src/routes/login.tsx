import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { translations, getLang, setLangStorage, type LangCode } from "../i18n";
import { createClient } from "@supabase/supabase-js";
import KeltosLogin from "../KeltosLogin";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
);

interface LoginValues {
  email: string;
  password: string;
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<LangCode>(getLang());
  const t = (key: string) => translations[key]?.[lang] || key;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const handleLogin = async (values: LoginValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
    navigate({ to: "/signals" });
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/signals` },
    });
    if (error) throw error;
  };

  const handleForgotPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  };

  const handleRegister = () => {
    alert("Kayıt sayfası henüz hazır değil. Lütfen yönetici ile iletişime geçin.");
  };

  return (
    <>
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
        <select
          value={lang}
          onChange={(e) => {
            const next = e.target.value as LangCode;
            setLang(next);
            setLangStorage(next);
          }}
          style={{ background: "transparent", border: "1px solid rgba(245,182,41,.25)", color: "#f5b629", borderRadius: 8, padding: "6px 10px" }}
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
          <option value="de">DE</option>
          <option value="fr">FR</option>
          <option value="ar">AR</option>
        </select>
      </div>
      <KeltosLogin
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onForgotPassword={handleForgotPassword}
        onRegister={handleRegister}
      />
    </>
  );
}
