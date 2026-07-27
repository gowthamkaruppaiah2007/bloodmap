import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Droplet, MapPin, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import Navbar from "@/components/Navbar";

const GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DonorSetup() {
  const navigate = useNavigate();
  const [bloodGroup, setBloodGroup] = useState<string>("");
  const [whatsapp, setWhatsapp] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [available, setAvailable] = useState(true);
  const [emergency, setEmergency] = useState("");
  const [saving, setSaving] = useState(false);

  const allDaysSelected = days.length === DAYS.length;

  useEffect(() => {
    document.title = "Register as donor · BloodMap AI";
  }, []);

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function toggleAllDays() {
    if (allDaysSelected) {
      setDays([]);
    } else {
      setDays([...DAYS]);
    }
  }

  function fetchLocation() {
    if (!("geolocation" in navigator)) return toast.error("Geolocation not supported");
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
        toast.success("Location captured");
      },
      (err) => {
        setLocLoading(false);
        toast.error(err.message || "Location denied");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bloodGroup) return toast.error("Pick a blood group");
    if (!coords) return toast.error("Share your live location first");
    if (days.length === 0) return toast.error("Pick at least one available day");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", u.user.id)
      .maybeSingle();
    const { error } = await supabase.from("donors").upsert(
      {
        user_id: u.user.id,
        full_name: profile?.full_name ?? "",
        blood_group: bloodGroup,
        whatsapp_number: whatsapp,
        latitude: coords.lat,
        longitude: coords.lng,
        available_days: days,
        start_time: startTime,
        end_time: endTime,
        is_available: available,
        emergency_contact: emergency || null,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("You're now a registered donor!");
    navigate("/home");
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-4xl font-bold">Donor registration</h1>
        <p className="text-muted-foreground text-sm mt-1">Tell us how and when people can reach you.</p>

        <form onSubmit={onSubmit} className="glass-card rounded-2xl p-6 md:p-8 mt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Blood group</Label>
              <Select value={bloodGroup} onValueChange={setBloodGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa">WhatsApp number</Label>
              <Input
                id="wa"
                type="tel"
                required
                placeholder="+1 555 000 0000"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Live location</Label>
            <button
              type="button"
              onClick={fetchLocation}
              className="w-full rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 flex items-center gap-3 hover:bg-primary/10 transition text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                {locLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : coords ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm">
                  {coords ? "Location captured" : "Share GPS location"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {coords
                    ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                    : "Tap to allow location access"}
                </div>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Available days</Label>
              <button
                type="button"
                onClick={toggleAllDays}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {allDaysSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition font-semibold ${
                  allDaysSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Checkbox checked={allDaysSelected} onCheckedChange={toggleAllDays} />
                <span className="text-sm">All Days</span>
              </label>
              {DAYS.map((d) => (
                <label
                  key={d}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition ${
                    days.includes(d)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                  <span className="text-sm">{d.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="st">Start time</Label>
              <Input
                id="st"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et">End time</Label>
              <Input
                id="et"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
            <div>
              <div className="font-medium text-sm">Currently available</div>
              <div className="text-xs text-muted-foreground">Pause to hide from search.</div>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ec">Emergency contact (optional)</Label>
            <Input
              id="ec"
              placeholder="Backup phone or name"
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving} size="lg" className="w-full shadow-glow">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save and continue
          </Button>
        </form>
      </main>
    </div>
  );
}
