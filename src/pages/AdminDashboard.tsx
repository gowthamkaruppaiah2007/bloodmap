import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Droplet,
  Users,
  HeartPulse,
  Activity,
  LogOut,
  Search,
  Download,
  Trash2,
  Ban,
  CheckCircle2,
  MapPin,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminGetStats,
  adminListUsers,
  adminListDonors,
  adminDeleteUser,
  adminSetUserBan,
  adminDeleteDonor,
  adminToggleDonorAvailability,
  ADMIN_EMAIL,
} from "@/lib/admin.functions";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

type Tab = "overview" | "users" | "donors" | "map";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    document.title = "Admin Dashboard · BloodMap AI";
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email?.toLowerCase();
      if (email !== ADMIN_EMAIL) {
        toast.error("Admin access required");
        navigate("/auth");
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("bloodmap_admin");
    navigate("/auth");
  }

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <div>
              <div className="font-bold text-lg leading-tight">Admin Console</div>
              <div className="text-xs text-muted-foreground">BloodMap AI</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {(["overview", "users", "donors", "map"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-md capitalize whitespace-nowrap ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "donors" && <DonorsTab />}
        {tab === "map" && <MapTab />}
      </main>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof adminGetStats>> | null>(null);

  useEffect(() => {
    adminGetStats()
      .then(setStats)
      .catch((e) => toast.error(e.message));
  }, []);

  if (!stats)
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { label: "Total Donors", value: stats.totalDonors, icon: Droplet, color: "text-red-500" },
    {
      label: "Active Donors",
      value: stats.activeDonors,
      icon: HeartPulse,
      color: "text-green-500",
    },
    { label: "Inactive", value: stats.inactiveDonors, icon: Activity, color: "text-orange-500" },
    { label: "Blood Groups", value: stats.bloodGroups, icon: Droplet, color: "text-purple-500" },
    { label: "New Today", value: stats.newToday, icon: Users, color: "text-cyan-500" },
  ];

  const bloodData = Object.entries(stats.bloodDist).map(([name, value]) => ({ name, value }));
  const monthlyData = Object.entries(stats.monthly)
    .sort()
    .map(([month, count]) => ({ month, count }));
  const availData = [
    { name: "Active", value: stats.activeDonors },
    { name: "Inactive", value: stats.inactiveDonors },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-xl p-4">
            <c.icon className={`w-5 h-5 ${c.color}`} />
            <div className="mt-2 text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Blood Group Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={bloodData} dataKey="value" nameKey="name" outerRadius={90} label>
                {bloodData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Active vs Inactive Donors">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={availData} dataKey="value" nameKey="name" outerRadius={90} label>
                <Cell fill="#10b981" />
                <Cell fill="#f97316" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Registrations" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-card rounded-xl p-4 ${className}`}>
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function UsersTab() {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof adminListUsers>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUsers(await adminListUsers());
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          !q ||
          u.email.toLowerCase().includes(q.toLowerCase()) ||
          u.full_name.toLowerCase().includes(q.toLowerCase()),
      ),
    [users, q],
  );

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search users…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv("users", filtered)}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto my-8" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Type</th>
                <th className="p-2">Joined</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{u.full_name || "—"}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.phone || "—"}</td>
                  <td className="p-2">{u.user_type || "—"}</td>
                  <td className="p-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-2">
                    {u.banned_until && new Date(u.banned_until) > new Date() ? (
                      <span className="text-orange-500 text-xs font-medium">Disabled</span>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">Active</span>
                    )}
                  </td>
                  <td className="p-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Toggle ban"
                      onClick={async () => {
                        const banned = !(u.banned_until && new Date(u.banned_until) > new Date());
                        try {
                          await adminSetUserBan({ userId: u.id, banned });
                          toast.success(banned ? "Disabled" : "Activated");
                          load();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {u.banned_until && new Date(u.banned_until) > new Date() ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Ban className="w-4 h-4 text-orange-500" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      onClick={async () => {
                        if (!confirm(`Delete ${u.email}?`)) return;
                        try {
                          await adminDeleteUser({ userId: u.id });
                          toast.success("Deleted");
                          load();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No users
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DonorsTab() {
  const [donors, setDonors] = useState<Awaited<ReturnType<typeof adminListDonors>>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [avail, setAvail] = useState("all");

  async function load() {
    setLoading(true);
    try {
      setDonors(await adminListDonors());
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      donors.filter((d) => {
        if (q && !d.full_name.toLowerCase().includes(q.toLowerCase())) return false;
        if (group !== "all" && d.blood_group !== group) return false;
        if (avail === "yes" && !d.is_available) return false;
        if (avail === "no" && d.is_available) return false;
        return true;
      }),
    [donors, q, group, avail],
  );

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search donors…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={avail} onValueChange={setAvail}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Available</SelectItem>
            <SelectItem value="no">Unavailable</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv("donors", filtered as unknown as Record<string, unknown>[])}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto my-8" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Group</th>
                <th className="p-2">WhatsApp</th>
                <th className="p-2">Available</th>
                <th className="p-2">Days</th>
                <th className="p-2">Time</th>
                <th className="p-2">Location</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{d.full_name}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-semibold text-xs">
                      {d.blood_group}
                    </span>
                  </td>
                  <td className="p-2">{d.whatsapp_number}</td>
                  <td className="p-2">{d.is_available ? "Yes" : "No"}</td>
                  <td className="p-2 text-xs">{(d.available_days ?? []).join(", ") || "—"}</td>
                  <td className="p-2 text-xs">
                    {d.start_time && d.end_time ? `${d.start_time}–${d.end_time}` : "—"}
                  </td>
                  <td className="p-2">
                    <a
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=15/${d.latitude}/${d.longitude}`}
                    >
                      <MapPin className="w-3 h-3" />
                      Map
                    </a>
                  </td>
                  <td className="p-2 text-xs">{new Date(d.updated_at).toLocaleDateString()}</td>
                  <td className="p-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Toggle availability"
                      onClick={async () => {
                        try {
                          await adminToggleDonorAvailability({ donorId: d.id, isAvailable: !d.is_available });
                          toast.success("Updated");
                          load();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {d.is_available ? (
                        <Ban className="w-4 h-4 text-orange-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      onClick={async () => {
                        if (!confirm(`Delete donor ${d.full_name}?`)) return;
                        try {
                          await adminDeleteDonor({ donorId: d.id });
                          toast.success("Deleted");
                          load();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No donors
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MapTab() {
  const [donors, setDonors] = useState<Awaited<ReturnType<typeof adminListDonors>>>([]);
  useEffect(() => {
    adminListDonors()
      .then(setDonors)
      .catch((e) => toast.error(e.message));
  }, []);

  const bounds = useMemo(() => {
    if (!donors.length) return "-180,-85,180,85";
    const lats = donors.map((d) => d.latitude),
      lngs = donors.map((d) => d.longitude);
    return `${Math.min(...lngs) - 0.1},${Math.min(...lats) - 0.1},${Math.max(...lngs) + 0.1},${Math.max(...lats) + 0.1}`;
  }, [donors]);

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <h3 className="font-semibold">Donor Locations ({donors.length})</h3>
      <div className="rounded-lg overflow-hidden border" style={{ height: 500 }}>
        <iframe
          title="Donor map"
          className="w-full h-full"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik${donors
            .slice(0, 1)
            .map((d) => `&marker=${d.latitude},${d.longitude}`)
            .join("")}`}
        />
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-auto">
        {donors.map((d) => (
          <a
            key={d.id}
            target="_blank"
            rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${d.latitude}&mlon=${d.longitude}#map=15/${d.latitude}/${d.longitude}`}
            className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm"
          >
            <MapPin className="w-4 h-4 text-primary" />
            <span className="font-medium">{d.full_name}</span>
            <span className="text-xs text-muted-foreground">{d.blood_group}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
