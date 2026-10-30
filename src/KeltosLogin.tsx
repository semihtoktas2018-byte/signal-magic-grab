import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type LoginValues = { email: string; password: string };

interface KeltosLoginProps {
  onLogin: (values: LoginValues) => void | Promise<void>;
  onGoogleLogin?: () => void | Promise<void>;
  onForgotPassword?: (email: string) => void | Promise<void>;
  onRegister?: () => void;
}

function messageOf(err: unknown, fallback: string) {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  const maybe = err as { message?: string; error_description?: string } | null;
  if (maybe && typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
  if (maybe && typeof maybe.error_description === "string" && maybe.error_description.trim())
    return maybe.error_description;
  return fallback;
}

export default function KeltosLogin({
  onLogin,
  onGoogleLogin,
  onForgotPassword,
  onRegister,
}: KeltosLoginProps) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState<"" | "login" | "google" | "forgot">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reset = () => {
    setError("");
    setNotice("");
  };

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    reset();
    if (!email.trim() || !password) {
      setError("E-posta ve şifre zorunludur.");
      return;
    }
    setBusy("login");
    try {
      await onLogin({ email: email.trim(), password });
    } catch (err) {
      setError(messageOf(err, "Giriş yapılamadı. Bilgileri kontrol edin."));
    } finally {
      setBusy("");
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    reset();
    if (!email.trim()) {
      setError("Sıfırlama bağlantısı için e-posta gerekli.");
      return;
    }
    setBusy("forgot");
    try {
      await onForgotPassword?.(email.trim());
      setNotice("Sıfırlama bağlantısı e-posta adresine gönderildi.");
    } catch (err) {
      setError(messageOf(err, "Sıfırlama bağlantısı gönderilemedi."));
    } finally {
      setBusy("");
    }
  };

  const google = async () => {
    if (!onGoogleLogin) return;
    reset();
    setBusy("google");
    try {
      await onGoogleLogin();
    } catch (err) {
      setError(messageOf(err, "Google ile giriş başarısız."));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="kl-root">
      <style>{`
        .kl-root{--bg:#05070c;--bg2:#0a0e16;--gold:#f5b629;--gold2:#ffd76a;--gold3:#c8941a;--text:#f0f4fa;--muted:#8a93a3;--line:rgba(245,182,41,.18);--card:rgba(255,255,255,.03);
          min-height:100vh;background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,sans-serif;
          display:flex;align-items:center;justify-content:center;padding:24px 16px;position:relative;overflow-x:hidden}
        .kl-root::before{content:"";position:absolute;inset:0;pointer-events:none;
          background:radial-gradient(60% 50% at 50% 0%,rgba(245,182,41,.10),transparent 70%),
                     radial-gradient(40% 40% at 90% 90%,rgba(245,182,41,.06),transparent 70%)}
        .kl-wrap{position:relative;width:100%;max-width:940px;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center}
        .kl-brand{padding:8px}
        .kl-mark{display:flex;align-items:center;gap:10px;margin-bottom:18px}
        .kl-badge{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
          background:linear-gradient(135deg,var(--gold),var(--gold3));color:#0b0d12;font-weight:800;font-size:18px;
          box-shadow:0 8px 24px rgba(245,182,41,.25)}
        .kl-name{font-size:22px;font-weight:800;letter-spacing:.06em}
        .kl-name span{color:var(--gold)}
        .kl-head{font-size:34px;line-height:1.15;font-weight:800;margin:0 0 12px;letter-spacing:-.01em}
        .kl-head em{font-style:normal;color:var(--gold)}
        .kl-sub{color:var(--muted);font-size:15px;line-height:1.6;margin:0 0 22px;max-width:42ch}
        .kl-feats{display:flex;flex-direction:column;gap:12px}
        .kl-feat{display:flex;gap:11px;align-items:flex-start;font-size:13.5px;color:#c4ccd8}
        .kl-feat i{color:var(--gold);margin-top:1px;flex:none}
        .kl-card{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));
          border:1px solid var(--line);border-radius:18px;padding:26px 22px;
          box-shadow:0 24px 60px rgba(0,0,0,.45)}
        .kl-card h2{margin:0 0 4px;font-size:20px;font-weight:700}
        .kl-card p.kl-lead{margin:0 0 20px;color:var(--muted);font-size:13.5px}
        .kl-label{display:block;font-size:12px;color:var(--muted);margin:0 0 6px;letter-spacing:.02em}
        .kl-field{position:relative;margin-bottom:14px}
        .kl-field svg.kl-ico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted)}
        .kl-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
          border-radius:11px;color:var(--text);font-size:14px;padding:12px 12px 12px 38px;outline:none;transition:border-color .15s,background .15s}
        .kl-input::placeholder{color:#5f6878}
        .kl-input:focus{border-color:rgba(245,182,41,.55);background:rgba(245,182,41,.05)}
        .kl-eye{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;
          color:var(--muted);padding:6px;border-radius:8px;display:grid;place-items:center}
        .kl-eye:hover{color:var(--gold)}
        .kl-row{display:flex;justify-content:space-between;align-items:center;margin:-2px 0 18px;font-size:12.5px}
        .kl-link{background:none;border:0;color:var(--gold);cursor:pointer;font-size:12.5px;padding:0;font-family:inherit}
        .kl-link:hover{text-decoration:underline}
        .kl-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:0;cursor:pointer;
          border-radius:11px;padding:12px 14px;font-size:14.5px;font-weight:700;font-family:inherit;
          background:linear-gradient(135deg,var(--gold2),var(--gold));color:#0b0d12;transition:filter .15s,transform .1s}
        .kl-btn:hover{filter:brightness(1.06)}
        .kl-btn:active{transform:translateY(1px)}
        .kl-btn:disabled{opacity:.6;cursor:not-allowed;filter:none}
        .kl-google{margin-top:12px;width:100%;display:flex;align-items:center;justify-content:center;gap:9px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:11px;
          color:var(--text);font-size:14px;font-weight:600;font-family:inherit;padding:11px 14px;cursor:pointer;transition:background .15s}
        .kl-google:hover{background:rgba(255,255,255,.09)}
        .kl-google:disabled{opacity:.6;cursor:not-allowed}
        .kl-sep{display:flex;align-items:center;gap:12px;margin:18px 0;color:#5f6878;font-size:11.5px;letter-spacing:.08em}
        .kl-sep::before,.kl-sep::after{content:"";flex:1;height:1px;background:rgba(255,255,255,.09)}
        .kl-alert{border-radius:11px;padding:10px 12px;font-size:13px;margin-bottom:14px;line-height:1.45}
        .kl-alert.err{background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.32);color:#fca5a5}
        .kl-alert.ok{background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.30);color:#86efac}
        .kl-foot{margin-top:18px;text-align:center;font-size:13px;color:var(--muted)}
        .kl-legal{margin-top:14px;text-align:center;font-size:11.5px;color:#5f6878;line-height:1.5}
        @keyframes kl-spin{to{transform:rotate(360deg)}}
        .kl-root .animate-spin{animation:kl-spin 1s linear infinite}
        @media (max-width:860px){
          .kl-wrap{grid-template-columns:1fr;gap:18px;max-width:420px}
          .kl-brand{padding:0;text-align:center}
          .kl-mark{justify-content:center}
          .kl-head{font-size:26px}
          .kl-sub{margin:0 auto 16px}
          .kl-feats{display:none}
          .kl-card{padding:22px 16px;border-radius:16px}
        }
      `}</style>

      <div className="kl-wrap">
        <div className="kl-brand">
          <div className="kl-mark">
            <div className="kl-badge">K</div>
            <div className="kl-name">
              KELTO<span>Ş</span>
            </div>
          </div>
          <h1 className="kl-head">
            Piyasa senin yerine <em>analiz edilsin</em>
          </h1>
          <p className="kl-sub">
            Canlı sinyaller, smart money takibi ve paper trade — hepsi tek panelde. Hesabına giriş
            yap, kaldığın yerden devam et.
          </p>
          <div className="kl-feats">
            <div className="kl-feat">
              <i>
                <TrendingUp size={16} />
              </i>
              <span>Gerçek piyasa verisiyle üretilen BUY / SELL / WAIT sinyalleri</span>
            </div>
            <div className="kl-feat">
              <i>
                <Sparkles size={16} />
              </i>
              <span>V1 ve V2 skorlama motorlarının karşılaştırmalı görünümü</span>
            </div>
            <div className="kl-feat">
              <i>
                <ShieldCheck size={16} />
              </i>
              <span>Şifren ve işlemlerin yalnızca sana ait, şifreli saklanır</span>
            </div>
          </div>
        </div>

        <div className="kl-card">
          {mode === "login" ? (
            <>
              <h2>Giriş yap</h2>
              <p className="kl-lead">E-posta ve şifrenle devam et.</p>

              {error && <div className="kl-alert err">{error}</div>}
              {notice && <div className="kl-alert ok">{notice}</div>}

              <form onSubmit={submitLogin} noValidate>
                <label className="kl-label" htmlFor="kl-email">
                  E-posta
                </label>
                <div className="kl-field">
                  <Mail size={16} className="kl-ico" />
                  <input
                    id="kl-email"
                    className="kl-input"
                    type="email"
                    autoComplete="email"
                    placeholder="ornek@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <label className="kl-label" htmlFor="kl-pass">
                  Şifre
                </label>
                <div className="kl-field">
                  <Lock size={16} className="kl-ico" />
                  <input
                    id="kl-pass"
                    className="kl-input"
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    className="kl-eye"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="kl-row">
                  <span />
                  <button
                    type="button"
                    className="kl-link"
                    onClick={() => {
                      reset();
                      setMode("forgot");
                    }}
                  >
                    Şifremi unuttum
                  </button>
                </div>

                <button className="kl-btn" type="submit" disabled={busy !== ""}>
                  {busy === "login" ? <Loader2 size={16} className="animate-spin" /> : null}
                  {busy === "login" ? "Giriş yapılıyor…" : "Giriş Yap"}
                </button>
              </form>

              {onGoogleLogin && (
                <>
                  <div className="kl-sep">VEYA</div>
                  <button className="kl-google" onClick={google} disabled={busy !== ""}>
                    {busy === "google" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.3 13.4 17.7 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l8 6.2C43.5 38.4 46.1 32 46.1 24.5z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-8-6.2C1.9 16.4 1 20.1 1 24s.9 7.6 2.6 10.8l8-6.2z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.2 0 11.5-2 15.4-5.6l-8-6.2c-2.1 1.4-4.9 2.4-7.4 2.4-6.3 0-11.7-3.9-13.4-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z"
                        />
                      </svg>
                    )}
                    Google ile devam et
                  </button>
                </>
              )}

              {onRegister && (
                <div className="kl-foot">
                  Hesabın yok mu?{" "}
                  <button className="kl-link" type="button" onClick={onRegister}>
                    Kayıt Ol
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Şifreni sıfırla</h2>
              <p className="kl-lead">
                E-posta adresine sıfırlama bağlantısı gönderelim.
              </p>

              {error && <div className="kl-alert err">{error}</div>}
              {notice && <div className="kl-alert ok">{notice}</div>}

              <form onSubmit={submitForgot} noValidate>
                <label className="kl-label" htmlFor="kl-reset-email">
                  E-posta
                </label>
                <div className="kl-field">
                  <Mail size={16} className="kl-ico" />
                  <input
                    id="kl-reset-email"
                    className="kl-input"
                    type="email"
                    autoComplete="email"
                    placeholder="ornek@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <button className="kl-btn" type="submit" disabled={busy !== ""}>
                  {busy === "forgot" ? <Loader2 size={16} className="animate-spin" /> : null}
                  {busy === "forgot" ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
                </button>
              </form>

              <div className="kl-foot">
                <button
                  className="kl-link"
                  type="button"
                  onClick={() => {
                    reset();
                    setMode("login");
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <ArrowLeft size={14} /> Giriş ekranına dön
                </button>
              </div>
            </>
          )}

          <div className="kl-legal">
            Giriş yaparak kullanım koşullarını ve gizlilik politikasını kabul etmiş olursun.
          </div>
        </div>
      </div>
    </div>
  );
}
