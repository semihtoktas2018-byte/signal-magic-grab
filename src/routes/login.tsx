import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import KeltosLogin from "../KeltosLogin";

const supabase = createClient(
  "https://gmwlkkebwpenocatlmty.supabase.co",
  "sb_publishable_vxLxplUzQw9qNSaZjX4ucA_LZ1NW3a1"
);

// KeltosLogin bileşeninin beklediği tipi burada netleştiriyoruz
interface LoginValues {
  email: string;
  password: string;
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();

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
    <KeltosLogin
      onLogin={handleLogin}
      onGoogleLogin={handleGoogleLogin}
      onForgotPassword={handleForgotPassword}
      onRegister={handleRegister}
    />
  );
}
