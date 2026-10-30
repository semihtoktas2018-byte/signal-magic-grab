import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import KeltosLogin from "../KeltosLogin";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
);

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    // Şimdilik sadece uyarı veriyoruz, kayıt sayfası yok.
    alert("Kayıt sayfası henüz hazır değil. Lütfen yönetici ile iletişime geçin.");
  };

  return (
    <KeltosLogin
      onLogin={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      onForgotPassword={handleForgotPassword}
      onRegister={handleRegister}
    />
  );
}
