import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = {
  claims?: {
    sub?: string;
    app_metadata?: { role?: string };
  };
};

function assertDeploymentAdmin(context: AdminContext) {
  if (context.claims?.app_metadata?.role !== "admin") {
    throw new Error("Bu işlem için kurulum yöneticisi yetkisi gerekir.");
  }
}

export const listDeploymentUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertDeploymentAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (error) throw new Error("Kullanıcı listesi alınamadı: " + error.message);
    return {
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        role: user.app_metadata?.role === "admin" ? "admin" : "user",
        banned: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
        emailConfirmed: Boolean(user.email_confirmed_at),
        lastSignInAt: user.last_sign_in_at ?? null,
        createdAt: user.created_at,
      })),
      limit: 100,
      total: data.users.length,
    };
  });

export const inviteDeploymentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: z.string().trim().email().max(254) }))
  .handler(async ({ context, data }) => {
    assertDeploymentAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) throw new Error("Davet gönderilemedi: " + error.message);
    return { id: invited.user.id, email: invited.user.email ?? data.email };
  });

export const setDeploymentUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), enabled: z.boolean() }))
  .handler(async ({ context, data }) => {
    assertDeploymentAdmin(context);
    if (context.claims?.sub === data.userId) {
      throw new Error("Kendi yönetici erişiminizi bu ekrandan kapatamazsınız.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
    if (listError) throw new Error("Kullanıcı doğrulaması yapılamadı: " + listError.message);
    const target = listed.users.find((user) => user.id === data.userId);
    if (!target) throw new Error("Kullanıcı bulunamadı. İlk 100 kullanıcı dışında olabilir.");
    if (!data.enabled && target.app_metadata?.role === "admin") {
      const activeAdmins = listed.users.filter((user) =>
        user.app_metadata?.role === "admin" &&
        (!user.banned_until || new Date(user.banned_until).getTime() <= Date.now())
      );
      if (activeAdmins.length <= 1) throw new Error("Son aktif yöneticinin erişimi kapatılamaz.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.enabled ? "none" : "876000h",
    });
    if (error) throw new Error("Kullanıcı erişimi güncellenemedi: " + error.message);
    return { success: true, enabled: data.enabled };
  });
