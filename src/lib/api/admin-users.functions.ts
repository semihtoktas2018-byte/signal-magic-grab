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
    const users = [];
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error("Kullanıcı listesi alınamadı: " + error.message);
      users.push(...data.users);
      if (data.users.length < 100) break;
    }
    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        role: user.app_metadata?.role === "admin" ? "admin" : "user",
        banned: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
        emailConfirmed: Boolean(user.email_confirmed_at),
        lastSignInAt: user.last_sign_in_at ?? null,
        createdAt: user.created_at,
      })),
      total: users.length,
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
    let target: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.getUserById>>["data"]["user"] | null = null;
    let activeAdmins = 0;
    for (let page = 1; ; page += 1) {
      const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (listError) throw new Error("Kullanıcı doğrulaması yapılamadı: " + listError.message);
      for (const user of listed.users) {
        if (user.id === data.userId) target = user;
        if (
          user.app_metadata?.role === "admin" &&
          (!user.banned_until || new Date(user.banned_until).getTime() <= Date.now())
        ) {
          activeAdmins += 1;
        }
      }
      if (listed.users.length < 100) break;
    }
    if (!target) throw new Error("Kullanıcı bulunamadı.");
    if (!data.enabled && target.app_metadata?.role === "admin" && activeAdmins <= 1) {
      throw new Error("Son aktif yöneticinin erişimi kapatılamaz.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.enabled ? "none" : "876000h",
    });
    if (error) throw new Error("Kullanıcı erişimi güncellenemedi: " + error.message);
    return { success: true, enabled: data.enabled };
  });
