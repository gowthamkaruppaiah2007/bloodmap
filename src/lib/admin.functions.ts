import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ADMIN_EMAIL = "gowthampooncholai@gmail.com";

export async function adminGetStats() {
  const [{ data: donors }, { data: profiles }, usersRes] = await Promise.all([
    supabaseAdmin.from("donors").select("id,blood_group,is_available,created_at,updated_at"),
    supabaseAdmin.from("profiles").select("id,created_at,user_type"),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newToday = (profiles ?? []).filter((p) => new Date(p.created_at) >= today).length;
  const bloodDist: Record<string, number> = {};
  (donors ?? []).forEach((d) => {
    bloodDist[d.blood_group] = (bloodDist[d.blood_group] || 0) + 1;
  });
  const monthly: Record<string, number> = {};
  (profiles ?? []).forEach((p) => {
    const k = new Date(p.created_at).toISOString().slice(0, 7);
    monthly[k] = (monthly[k] || 0) + 1;
  });

  return {
    totalUsers: usersRes.data?.users.length ?? 0,
    totalDonors: donors?.length ?? 0,
    activeDonors: (donors ?? []).filter((d) => d.is_available).length,
    inactiveDonors: (donors ?? []).filter((d) => !d.is_available).length,
    bloodGroups: Object.keys(bloodDist).length,
    newToday,
    bloodDist,
    monthly,
  };
}

export async function adminListUsers() {
  const [{ data: authRes }, { data: profiles }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin.from("profiles").select("*"),
  ]);
  const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (authRes?.users ?? []).map((u) => {
    const p = pmap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? "",
      full_name: p?.full_name ?? (u.user_metadata?.full_name as string) ?? "",
      phone: p?.phone ?? "",
      user_type: p?.user_type ?? null,
      created_at: u.created_at,
      banned_until: (u as unknown as { banned_until?: string }).banned_until ?? null,
    };
  });
}

export async function adminListDonors() {
  const { data } = await supabaseAdmin
    .from("donors")
    .select("*")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

export async function adminDeleteUser(data: { userId: string }) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminSetUserBan(data: { userId: string; banned: boolean }) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
    ban_duration: data.banned ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminDeleteDonor(data: { donorId: string }) {
  const { error } = await supabaseAdmin.from("donors").delete().eq("id", data.donorId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function adminToggleDonorAvailability(data: {
  donorId: string;
  isAvailable: boolean;
}) {
  const { error } = await supabaseAdmin
    .from("donors")
    .update({ is_available: data.isAvailable })
    .eq("id", data.donorId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
