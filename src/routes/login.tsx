import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
);

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/signals" });
      }
    } catch (error: any) {
      setMessage(error.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "#05070c",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, sans-serif",
      color: "#f0f4fa",
      padding: "20px"
    }}>
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(245,182,41,0.2)",
        borderRadius: "16px",
        padding: "32px",
        width: "100%",
        maxWidth: "400px"
      }}>
        <h1 style={{
          fontSize: "24px",
          fontWeight: 900,
          background: "linear-gradient(135deg,#f5b629,#ffd76a)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textAlign: "center",
          marginBottom: "8px"
        }}>KELTOŞ</h1>
        <p style={{ textAlign: "center", color: "#8a93a3", fontSize: "14px", marginBottom: "24px" }}>
          {isSignUp ? "Hesap Oluştur" : "Giriş Yap"}
        </p>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input
            type="email"
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid rgba(245,182,41,0.2)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: "14px"
            }}
          />
          <input
            type="password"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid rgba(245,182,41,0.2)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: "14px"
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg,#f5b629,#ffd76a)",
              color: "#05070c",
              fontWeight: 800,
              fontSize: "14px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? "İşleniyor..." : (isSignUp ? "Kayıt Ol" : "Giriş Yap")}
          </button>
        </form>

        {message && (
          <div style={{
            marginTop: "16px",
            padding: "10px",
            borderRadius: "8px",
            background: "rgba(245,182,41,0.1)",
            border: "1px solid rgba(245,182,41,0.3)",
            color: "#f5b629",
            fontSize: "13px",
            textAlign: "center"
          }}>
            {message}
          </div>
        )}

        <button
          onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
          style={{
            marginTop: "16px",
            background: "transparent",
            border: "none",
            color: "#8a93a3",
            fontSize: "13px",
            cursor: "pointer",
            textDecoration: "underline",
            width: "100%"
          }}
        >
          {isSignUp ? "Zaten hesabınız var mı? Giriş yapın" : "Hesabınız yok mu? Kayıt olun"}
        </button>
      </div>
    </div>
  );
}
