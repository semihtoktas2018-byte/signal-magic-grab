import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import "../KeltosLogin.css";

type LoginValues = { email: string; password: string };
type RegisterResult = { emailConfirmationRequired: boolean };
interface KeltosLoginProps {
  onLogin: (values: LoginValues) => void | Promise<void>;
  onGoogleLogin?: () => void | Promise<void>;
  onForgotPassword?: (email: string) => void | Promise<void>;
  onRegister?: (values: LoginValues) => Promise<RegisterResult | void>;
}

function messageOf(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  const value = err as { message?: string; error_description?: string } | null;
  return value?.message || value?.error_description || fallback;
}

export default function KeltosLogin({ onLogin, onGoogleLogin, onForgotPassword, onRegister }: KeltosLoginProps) {
  const [mode, setMode] = useState<"login" | "forgot" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resetMessages = () => { setError(""); setNotice(""); };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); resetMessages();
    if (!email.trim() || !password) { setError("E-posta ve şifre zorunludur."); return; }
    setBusy("login");
    try { await onLogin({ email: email.trim(), password }); }
    catch (err) { setError(messageOf(err, "Giriş yapılamadı. Bilgileri kontrol edin.")); }
    finally { setBusy(""); }
  };

  const submitForgot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); resetMessages();
    if (!email.trim()) { setError("Sıfırlama bağlantısı için e-posta gerekli."); return; }
    if (!onForgotPassword) { setError("Şifre sıfırlama şu anda kullanılamıyor."); return; }
    setBusy("forgot");
    try { await onForgotPassword(email.trim()); setNotice("Sıfırlama bağlantısı talebi gönderildi. E-posta kutunu kontrol et."); }
    catch (err) { setError(messageOf(err, "Sıfırlama bağlantısı gönderilemedi.")); }
    finally { setBusy(""); }
  };

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); resetMessages();
    if (!email.trim() || !password || !confirmPassword) { setError("Tüm alanları doldur."); return; }
    if (password.length < 8) { setError("Şifre en az 8 karakter olmalıdır."); return; }
    if (password !== confirmPassword) { setError("Şifreler eşleşmiyor."); return; }
    if (!onRegister) { setError("Kayıt işlemi şu anda kullanılamıyor."); return; }
    setBusy("register");
    try {
      const result = await onRegister({ email: email.trim(), password });
      if (result?.emailConfirmationRequired) setNotice("Hesabın oluşturuldu. E-posta adresine gönderilen doğrulama bağlantısını kullan.");
    } catch (err) { setError(messageOf(err, "Hesap oluşturulamadı.")); }
    finally { setBusy(""); }
  };

  const submitGoogle = async () => {
    if (!onGoogleLogin) return;
    resetMessages(); setBusy("google");
    try { await onGoogleLogin(); }
    catch (err) { setError(messageOf(err, "Google ile giriş başarısız.")); }
    finally { setBusy(""); }
  };

  const isBusy = busy !== "";
  return (
    <main className="kt-login">
      <div className="kt-grid" aria-hidden="true" />
      <div className="kt-orb kt-orb-one" aria-hidden="true" />
      <div className="kt-orb kt-orb-two" aria-hidden="true" />
      <div className="kt-particles" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <i key={index} className={"kt-particle kt-particle-" + (index + 1)} />)}
      </div>
      <div className="kt-shell">
        <section className="kt-brand" aria-label="KELTOŞ PARA'YA KOŞ">
          <div className="kt-brand-kicker"><span className="kt-brand-line" /><span>MARKET INTELLIGENCE</span><span className="kt-brand-line" /></div>
          <div className="kt-emblem" aria-hidden="true">
            <span className="kt-emblem-ring kt-emblem-ring-outer" /><span className="kt-emblem-ring kt-emblem-ring-inner" />
            <span className="kt-coin kt-coin-left">₿</span><span className="kt-coin kt-coin-right">Ξ</span><span className="kt-coin kt-coin-top">$</span>
            <div className="kt-emblem-center"><span className="kt-emblem-overline">DATA · SIGNAL · STRATEGY</span><div className="kt-emblem-bars"><i /><i /><i /><i /><i /><i /><i /></div><span className="kt-emblem-caption">READ THE MARKET</span></div>
          </div>
          <h1 className="kt-slogan"><span>KELTOŞ</span><strong>PARA'YA KOŞ</strong></h1>
          <p className="kt-brand-description">Piyasayı takip et. Veriyi oku. <b>Kararını bilinçli ver.</b></p>
          <div className="kt-brand-foot"><span className="kt-foot-dot" /><span>SMART MARKET TRACKING</span><span className="kt-foot-dot" /></div>
        </section>
        <section className="kt-card">
          <div className="kt-card-topline" />
          <header className="kt-card-heading"><span className="kt-card-eyebrow">KELTOŞ TERMINAL</span><h2>{mode === "login" ? "Hesabına giriş yap" : mode === "forgot" ? "Şifreni sıfırla" : "Hesabını oluştur"}</h2><p>{mode === "login" ? "Piyasa ekranına kaldığın yerden devam et." : mode === "forgot" ? "E-posta adresine sıfırlama bağlantısı gönderelim." : "Yeni hesabını oluşturmak için bilgilerini gir."}</p></header>
          {error && <div className="kt-feedback kt-feedback-error" role="alert">{error}</div>}
          {notice && <div className="kt-feedback kt-feedback-success" role="status">{notice}</div>}
          {mode === "login" && <form className="kt-form" onSubmit={submitLogin} noValidate>
            <label className="kt-label" htmlFor="kt-email">E-POSTA ADRESİ</label><div className="kt-input-wrap"><Mail aria-hidden="true" /><input id="kt-email" type="email" autoComplete="email" placeholder="ornek@mail.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label className="kt-label kt-password-label" htmlFor="kt-password"><span>ŞİFRE</span><button className="kt-text-button" type="button" onClick={() => { resetMessages(); setMode("forgot"); }}>Şifremi unuttum</button></label>
            <div className="kt-input-wrap"><Lock aria-hidden="true" /><input id="kt-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Şifren" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="kt-eye" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <button className="kt-submit" type="submit" disabled={isBusy}>{busy === "login" ? <Loader2 className="kt-spinner" size={17} /> : null}{busy === "login" ? "GİRİŞ YAPILIYOR" : "GİRİŞ YAP"}<span className="kt-submit-arrow">→</span></button>
          </form>}
          {mode === "forgot" && <form className="kt-form" onSubmit={submitForgot} noValidate>
            <label className="kt-label" htmlFor="kt-forgot-email">E-POSTA ADRESİ</label><div className="kt-input-wrap"><Mail aria-hidden="true" /><input id="kt-forgot-email" type="email" autoComplete="email" placeholder="ornek@mail.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <button className="kt-submit" type="submit" disabled={isBusy}>{busy === "forgot" ? <Loader2 className="kt-spinner" size={17} /> : null}SIFIRLAMA BAĞLANTISI GÖNDER</button>
            <button className="kt-back" type="button" onClick={() => { resetMessages(); setMode("login"); }}><ArrowLeft size={14} /> Giriş ekranına dön</button>
          </form>}
          {mode === "register" && <form className="kt-form" onSubmit={submitRegister} noValidate>
            <label className="kt-label" htmlFor="kt-register-email">E-POSTA ADRESİ</label><div className="kt-input-wrap"><Mail aria-hidden="true" /><input id="kt-register-email" type="email" autoComplete="email" placeholder="ornek@mail.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label className="kt-label" htmlFor="kt-register-password">ŞİFRE (EN AZ 8 KARAKTER)</label><div className="kt-input-wrap"><Lock aria-hidden="true" /><input id="kt-register-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Şifre oluştur" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="kt-eye" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            <label className="kt-label" htmlFor="kt-confirm-password">ŞİFRE TEKRARI</label><div className="kt-input-wrap"><Lock aria-hidden="true" /><input id="kt-confirm-password" type="password" autoComplete="new-password" placeholder="Şifreni tekrar gir" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
            <button className="kt-submit" type="submit" disabled={isBusy}>{busy === "register" ? <Loader2 className="kt-spinner" size={17} /> : null}{busy === "register" ? "HESAP OLUŞTURULUYOR" : "HESAP OLUŞTUR"}<span className="kt-submit-arrow">→</span></button>
            <button className="kt-back" type="button" onClick={() => { resetMessages(); setMode("login"); }}>Giriş ekranına dön</button>
          </form>}
          {mode === "login" && onGoogleLogin && <><div className="kt-divider">VEYA</div><button className="kt-google" type="button" onClick={submitGoogle} disabled={isBusy}>{busy === "google" ? <Loader2 className="kt-spinner" size={17} /> : <span aria-hidden="true">G</span>} Google ile devam et</button></>}
          {mode === "login" && onRegister && <div className="kt-register">Henüz hesabın yok mu?<button type="button" onClick={() => { resetMessages(); setMode("register"); }}>Kayıt ol</button></div>}
          {mode === "login" && <div className="kt-card-security"><ShieldCheck aria-hidden="true" /><span>GÜVENLİ OTURUM · SUPABASE AUTH</span></div>}
        </section>
      </div>
      <footer className="kt-footer"><span>KELTOŞ</span><span className="kt-footer-separator">◆</span><span>PARA'YA KOŞ</span><span className="kt-footer-note">Piyasa verileri yatırım tavsiyesi değildir.</span></footer>
    </main>
  );
}