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
  const [isForgot, setIsForgot] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        setMessage("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.");
        setIsForgot(false);
      } else if (isSignUp) {
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

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/signals`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage(error.message || "Google ile giriş başarısız.");
    }
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, #05070c 0%, #0a0f1a 100%)",
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
        borderRadius: "20px",
        padding: "40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 50px -20px rgba(245,182,41,0.3)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontSize: "32px",
            fontWeight: 900,
            background: "linear-gradient(135deg,#f5b629,#ffd76a)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "8px"
          }}>KELTOŞ</h1>
          <p style={{ color: "#8a93a3", fontSize: "14px" }}>
            {isForgot ? "Şifremi Unuttum" : isSignUp ? "Hesap Oluştur" : "Giriş Yap"}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input
            type="email"
            placeholder="E-posta adresiniz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid rgba(245,182,41,0.2)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: "14px",
              outline: "none"
            }}
          />
          {!isForgot && (
            <input
              type="password"
              placeholder="Şifreniz"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid rgba(245,182,41,0.2)",
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                fontSize: "14px",
                outline: "none"
              }}
            />
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px",
              borderRadius: "10px",
              border: "none",
              background: "linear-gradient(135deg,#f5b629,#ffd76a)",
              color: "#05070c",
              fontWeight: 800,
              fontSize: "15px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "transform 0.2s"
            }}
          >
            {loading ? "İşleniyor..." : isForgot ? "Sıfırlama Linki Gönder" : (isSignUp ? "Kayıt Ol" : "Giriş Yap")}
          </button>
        </form>

        {!isForgot && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "20px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
              <span style={{ color: "#8a93a3", fontSize: "12px" }}>veya</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google ile Giriş Yap
            </button>
          </>
        )}

        {message && (
          <div style={{
            marginTop: "16px",
            padding: "12px",
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

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setIsForgot(false); setMessage(null); }}
            style={{
              background: "transparent",
              border: "none",
              color: "#8a93a3",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            {isSignUp ? "Zaten hesabınız var mı? Giriş yapın" : "Hesabınız yok mu? Kayıt olun"}
          </button>
          <button
            onClick={() => { setIsForgot(!isForgot); setIsSignUp(false); setMessage(null); }}
            style={{
              background: "transparent",
              border: "none",
              color: "#f5b629",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            {isForgot ? "Giriş yap" : "Şifremi unuttum"}
          </button>
        </div>
      </div>
    </div>
  );
}
