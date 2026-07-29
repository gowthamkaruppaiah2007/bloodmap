import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Shield,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  Droplet,
  Edit3,
  Clock,
  Compass,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import Navbar from "@/components/Navbar";

export default function UserProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  // User auth & profile data
  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  
  // Profile form state
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [userType, setUserType] = useState<"seeker" | "donor">("seeker");

  // Donor specific state (if registered as donor)
  const [donorId, setDonorId] = useState<string | null>(null);
  const [bloodGroup, setBloodGroup] = useState<string>("O+");
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [emergencyContact, setEmergencyContact] = useState<string>("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("18:00");

  // Activity stats
  const [myRequestsCount, setMyRequestsCount] = useState<number>(0);

  useEffect(() => {
    document.title = "My Profile · BloodMap AI";
    loadUserProfile();
  }, []);

  async function loadUserProfile() {
    setLoading(true);
    const { data: authRes } = await supabase.auth.getUser();
    if (!authRes.user) {
      navigate("/auth");
      return;
    }

    const u = authRes.user;
    setUserId(u.id);
    setEmail(u.email ?? "");
    setCreatedAt(u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "");

    // 1. Fetch Profile Data
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();

    if (p) {
      setFullName(p.full_name ?? (u.user_metadata?.full_name as string) ?? "");
      setPhone(p.phone ?? (u.user_metadata?.phone as string) ?? "");
      setAddress((p.address as string) ?? (u.user_metadata?.address as string) ?? "");
      if (p.user_type === "donor" || p.user_type === "seeker") {
        setUserType(p.user_type);
      }
    } else {
      setFullName((u.user_metadata?.full_name as string) ?? "");
      setPhone((u.user_metadata?.phone as string) ?? "");
    }

    // 2. Fetch Donor record if present
    const { data: d } = await supabase
      .from("donors")
      .select("*")
      .eq("user_id", u.id)
      .maybeSingle();

    if (d) {
      setDonorId(d.id);
      setUserType("donor");
      setBloodGroup(d.blood_group || "O+");
      setIsAvailable(d.is_available);
      setEmergencyContact(d.emergency_contact ?? "");
      setAvailableDays(d.available_days ?? []);
      setStartTime(d.start_time ?? "09:00");
      setEndTime(d.end_time ?? "18:00");
    }

    // 3. Fetch user's blood requests count
    const { count } = await supabase
      .from("blood_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id);

    setMyRequestsCount(count ?? 0);
    setLoading(false);
  }

  // Geolocation reverse lookup for current address
  async function detectCurrentLocation() {
    if (!navigator.geolocation) {
      return toast.error("Geolocation is not supported by your browser.");
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Free Nominatim OpenStreetMap reverse geocoding
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
            toast.success("Location address detected!");
          } else {
            setAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
          }
        } catch {
          setAddress(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error("Could not retrieve current location: " + err.message);
      }
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Full Name cannot be empty.");
    setSaving(true);

    try {
      // 1. Update Profiles table
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email,
        address: address.trim(),
        user_type: userType,
        updated_at: new Date().toISOString(),
      });

      if (pErr) throw pErr;

      // 2. Update auth user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        },
      });

      // 3. Update Donor record if donor exists
      if (donorId) {
        const { error: dErr } = await supabase
          .from("donors")
          .update({
            full_name: fullName.trim(),
            whatsapp_number: phone.trim(),
            blood_group: bloodGroup,
            is_available: isAvailable,
            emergency_contact: emergencyContact.trim(),
            start_time: startTime,
            end_time: endTime,
            updated_at: new Date().toISOString(),
          })
          .eq("id", donorId);

        if (dErr) throw dErr;
      }

      toast.success("Profile & Address updated successfully!");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDonorAvailability(val: boolean) {
    setIsAvailable(val);
    if (!donorId) return;
    const { error } = await supabase
      .from("donors")
      .update({ is_available: val })
      .eq("id", donorId);
    if (error) {
      toast.error("Could not update availability: " + error.message);
      setIsAvailable(!val);
    } else {
      toast.success(val ? "You are now marked as AVAILABLE for donations!" : "You are marked as UNAVAILABLE.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
        <Navbar />
        <div className="flex-1 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6 flex-1 w-full">
        {/* Profile Hero Header Card */}
        <div className="glass-card rounded-3xl overflow-hidden border border-border shadow-xl">
          <div className="h-32 bg-gradient-to-r from-red-600 via-rose-500 to-primary relative p-6 flex items-end">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
            <div className="relative z-10 flex items-center justify-between w-full">
              <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur border-white/20 text-xs px-3 py-1 font-semibold">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> BloodMap AI Profile
              </Badge>
              {createdAt && (
                <span className="text-xs text-white/80 flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5" /> Member since {createdAt}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-4">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-rose-600 border-4 border-background shadow-xl flex items-center justify-center text-white text-3xl font-extrabold tracking-wider">
                  {initials}
                </div>
                <div className="mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{fullName || "User Profile"}</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-4 h-4 text-primary" /> {email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {donorId ? (
                  <Badge variant="default" className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 shadow-glow">
                    <Droplet className="w-4 h-4 fill-white" /> Donor ({bloodGroup})
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="px-3 py-1.5 text-sm font-semibold flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-primary" /> Seeker Account
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
              <div className="p-3 rounded-xl bg-muted/50 flex flex-col">
                <span className="text-xs text-muted-foreground font-medium">My Blood Requests</span>
                <span className="text-lg font-bold text-foreground">{myRequestsCount} Request(s)</span>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 flex flex-col">
                <span className="text-xs text-muted-foreground font-medium">Donor Status</span>
                <span className="text-lg font-bold text-foreground">
                  {donorId ? (isAvailable ? "Available🟢" : "Busy 🔴") : "Not Registered"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 col-span-2 sm:col-span-1 flex flex-col">
                <span className="text-xs text-muted-foreground font-medium">Phone Contact</span>
                <span className="text-lg font-bold text-foreground truncate">{phone || "Not set"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Edit & Address Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Section 1: My Address (Highlighted as requested) */}
          <div className="glass-card rounded-2xl p-6 border border-border shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">My Address Details</h2>
                  <p className="text-xs text-muted-foreground">Add and manage your home or emergency address</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectCurrentLocation}
                disabled={locating}
                className="text-xs font-semibold"
              >
                {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Compass className="w-3.5 h-3.5 mr-1.5 text-primary" />}
                Auto-Detect Location
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-address" className="font-semibold">Full Residential / Emergency Address</Label>
              <Textarea
                id="user-address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street, landmark, city, state, and pincode (e.g. 123 Health Ave, Anna Nagar, Chennai, 600040)"
                className="resize-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Your address helps match nearby blood requests and emergency alerts efficiently.
              </p>
            </div>
          </div>

          {/* Section 2: Personal Information */}
          <div className="glass-card rounded-2xl p-6 border border-border shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Personal Information</h2>
                <p className="text-xs text-muted-foreground">Update your personal contact information</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-fullname" className="font-semibold">Full Name</Label>
                <Input
                  id="user-fullname"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email" className="font-semibold">Email Address (Account)</Label>
                <Input
                  id="user-email"
                  type="email"
                  disabled
                  value={email}
                  className="bg-muted opacity-80 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-phone" className="font-semibold">Phone / WhatsApp Number</Label>
                <Input
                  id="user-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role" className="font-semibold">Account Role</Label>
                <div className="flex items-center gap-3 pt-1">
                  <Badge variant={userType === "donor" ? "default" : "outline"} className="px-3 py-1 text-sm font-semibold">
                    {userType === "donor" ? "Registered Donor" : "Blood Seeker"}
                  </Badge>
                  {userType === "seeker" && (
                    <Button asChild variant="link" size="sm" className="text-primary text-xs p-0 h-auto">
                      <Link to="/donor-setup">Switch to Donor &rarr;</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Donor Settings (if donor) */}
          {donorId && (
            <div className="glass-card rounded-2xl p-6 border border-border shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Droplet className="w-5 h-5 fill-red-500 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Donor & Availability Settings</h2>
                    <p className="text-xs text-muted-foreground">Manage your donor card details and availability status</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{isAvailable ? "Available" : "Unavailable"}</span>
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={toggleDonorAvailability}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="donor-bloodgroup" className="font-semibold">Blood Group</Label>
                  <select
                    id="donor-bloodgroup"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donor-emergency" className="font-semibold">Emergency Contact Number</Label>
                  <Input
                    id="donor-emergency"
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="+91 91234 56789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-time" className="font-semibold">Available From (Time)</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time" className="font-semibold">Available Until (Time)</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {availableDays.length > 0 && (
                <div className="pt-2">
                  <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Active Donation Days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDays.map((day) => (
                      <Badge key={day} variant="secondary" className="text-xs">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Save Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <Button asChild variant="outline">
              <Link to="/home">Back to Home</Link>
            </Button>

            <Button type="submit" disabled={saving} size="lg" className="shadow-glow px-8">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile & Address
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
