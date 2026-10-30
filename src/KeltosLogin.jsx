import React, { useState } from "react";
import "./KeltosLogin.css";

/**
 * KELTOŞ login screen — presentation layer only.
 *
 * Connect the callbacks to your existing authentication system:
 * - onLogin({ email, password })
 * - onGoogleLogin()
 * - onForgotPassword(email)
 * - onRegister()
 *
 * No credentials are stored here and no fake market/user statistics are shown.
 */
export default function KeltosLogin({
  onLogin,
  onGoogleLogin,
  onForgotPassword,
  onRegister,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("E-posta ve şifre alanlarını doldurun.");
      return;
    }

    if (typeof onLogin !== "function") {
      setMessage("Giriş servisi henüz bağlanmadı.");
      return;
    }

    try {
      await onLogin({ email: email.trim(), password, remember });
    } catch (error) {
      setMessage(error?.message || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
    }
  };

  const forgot = async () => {
    setMessage("");
    if (!email.trim()) {
      setMessage("Şifre sıfırlama bağlantısı için önce e-posta adresinizi yazın.");
      return;
    }
    if (typeof onForgotPassword !== "function") {
      setMessage("Şifre sıfırlama servisi henüz bağlanmadı.");
      return;
    }
    try {
      await onForgotPassword(email.trim());
      setMessage("Şifre sıfırlama isteği gönderildi. E-postanızı kontrol edin.");
    } catch (error) {
      setMessage(error?.message || "Şifre sıfırlama isteği gönderilemedi.");
    }
  };

  return (
    <main className="kt-login">
      <div className="kt-grid" aria-hidden="true" />
      <div className="kt-orb kt-orb-one" aria-hidden="true" />
      <div className="kt-orb kt-orb-two" aria-hidden="true" />
      <div className="kt-particles" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => (
          <i key={i} className={`kt-particle kt-particle-${i + 1}`} />
        ))}
      </div>

      <div className="kt-shell">
        <section className="kt-brand" aria-label="KELTOŞ PARA'YA KOŞ">
          <div className="kt-brand-kicker">
            <span className="kt-brand-line" />
            <span>KELTOŞ</span>
            <span className="kt-brand-line" />
          </div>

          <div className="kt-emblem" aria-hidden="true">
            <div className="kt-emblem-ring kt-emblem-ring-outer" />
            <div className="kt-emblem-ring kt-emblem-ring-inner" />
            <span className="kt-coin kt-coin-left">₺</span>
            <span className="kt-coin kt-coin-right">$</span>
            <span className="kt-coin kt-coin-top">€</span>
            <div className="kt-emblem-center">
              <span className="kt-emblem-overline">PİYASAYI TAKİP ET</span>
              <div className="kt-emblem-bars">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
              <span className="kt-emblem-caption">FİNANS • KRİPTO • PİYASA</span>
            </div>
          </div>

          <h1 className="kt-slogan">
            <span>PARA'YA</span>
            <strong>KOŞ</strong>
          </h1>
          <p className="kt-brand-description">
            Piyasayı takip et. Sinyallerini keşfet. <b>Kararını kendin ver.</b>
          </p>
          <div className="kt-brand-foot">
            <span className="kt-foot-dot" />
            KRİPTO SİNYAL PLATFORMU
            <span className="kt-foot-dot" />
          </div>
        </section>

        <section className="kt-card">
          <div className="kt-card-topline" />
          <div className="kt-card-heading">
            <span className="kt-card-eyebrow">HESABINA ERİŞ</span>
            <h2>Tekrar hoş geldin</h2>
            <p>Devam etmek için hesabına giriş yap.</p>
          </div>

          <form className="kt-form" onSubmit={submit}>
            <label className="kt-label" htmlFor="kt-email">E-POSTA ADRESİ</label>
            <div className="kt-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>
              <input
                id="kt-email"
                type="email"
                autoComplete="email"
                placeholder="ornek@eposta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="kt-password-label">
              <label className="kt-label" htmlFor="kt-password">ŞİFRE</label>
              <button className="kt-text-button" type="button" onClick={forgot}>Şifremi unuttum</button>
            </div>
            <div className="kt-input-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v2"/></svg>
              <input
                id="kt-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                className="kt-eye"
                type="button"
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "GİZLE" : "GÖSTER"}
              </button>
            </div>

            <label className="kt-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="kt-checkmark" />
              <span>Oturumumu açık tut</span>
            </label>

            {message && <p className="kt-message" role="status">{message}</p>}

            <button className="kt-submit" type="submit">
              <span>GİRİŞ YAP</span>
              <span className="kt-submit-arrow">→</span>
            </button>
          </form>

          <div className="kt-divider"><span>VEYA</span></div>

          <button
            className="kt-google"
            type="button"
            onClick={() => {
              setMessage("");
              if (typeof onGoogleLogin === "function") onGoogleLogin();
              else setMessage("Google ile giriş henüz bağlanmadı.");
            }}
          >
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z"/>
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"/>
              <path fill="#4A90E2" d="M12.6 27.7a12 12 0 0 1 0-7.4V15H5.8a20 20 0 0 0 0 17.9l6.8-5.2z"/>
              <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4z"/>
            </svg>
            Google ile devam et
          </button>

          <p className="kt-register">
            Henüz hesabın yok mu?
            <button type="button" onClick={() => onRegister?.()}>Hemen kayıt ol</button>
          </p>
          <div className="kt-card-security">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.2 16 4.5v4.8c0 4-2.5 6.7-6 8.5-3.5-1.8-6-4.5-6-8.5V4.5L10 2.2Z"/><path d="m7.2 9.7 1.8 1.8 3.8-4"/></svg>
            GÜVENLİ HESAP ERİŞİMİ
          </div>
        </section>
      </div>

      <footer className="kt-footer">
        <span>© {new Date().getFullYear()} KELTOŞ</span>
        <span className="kt-footer-separator">•</span>
        <span>PARA'YA KOŞ</span>
        <span className="kt-footer-note">Kripto varlık piyasaları yüksek risk içerir.</span>
      </footer>
    </main>
  );
}
