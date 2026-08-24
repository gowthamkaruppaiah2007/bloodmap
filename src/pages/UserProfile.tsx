import { useEffect, useState, useRef } from "react";
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
  Camera,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { processAndUploadAvatar } from "@/lib/avatarUtils";
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [userType, setUserType] = useState<"seeker" | "donor">("seeker");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setAvatarUrl(p.avatar_url ?? (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null);
      if (p.user_type === "donor" || p.user_type === "seeker") {
        setUserType(p.user_type);
      }
    } else {
      setFullName((u.user_metadata?.full_name as string) ?? "");
      setPhone((u.user_metadata?.phone as string) ?? "");
      setAvatarUrl((u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null);
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
      // 1. Update auth user metadata first (always succeeds)
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          avatar_url: avatarUrl,
        },
      });

      // 2. Update Profiles table
      const profileData: any = {
        id: userId,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email,
        address: address.trim(),
        user_type: userType,
        updated_at: new Date().toISOString(),
      };
      if (avatarUrl !== undefined) {
        profileData.avatar_url = avatarUrl;
      }

      let { error: pErr } = await supabase.from("profiles").upsert(profileData);

      // Fallback if avatar_url column doesn't exist in profiles table yet
      if (pErr && pErr.message.includes("avatar_url")) {
        delete profileData.avatar_url;
        const { error: retryErr } = await supabase.from("profiles").upsert(profileData);
        if (retryErr) throw retryErr;
      } else if (pErr) {
        throw pErr;
      }

      // 3. Update Donor record if donor exists
      if (donorId) {
        const donorData: any = {
          full_name: fullName.trim(),
          whatsapp_number: phone.trim(),
          blood_group: bloodGroup,
          is_available: isAvailable,
          emergency_contact: emergencyContact.trim(),
          start_time: startTime,
          end_time: endTime,
          updated_at: new Date().toISOString(),
        };
        if (avatarUrl !== undefined) {
          donorData.avatar_url = avatarUrl;
        }

        let { error: dErr } = await supabase
          .from("donors")
          .update(donorData)
          .eq("id", donorId);

        if (dErr && dErr.message.includes("avatar_url")) {
          delete donorData.avatar_url;
          await supabase.from("donors").update(donorData).eq("id", donorId);
        } else if (dErr) {
          throw dErr;
        }
      }

      toast.success("Profile & Address updated successfully!");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Please select a valid image file (PNG, JPG, WebP).");
    }

    setUploadingAvatar(true);
    try {
      const uploadedUrl = await processAndUploadAvatar(userId, file);
      setAvatarUrl(uploadedUrl);

      // 1. Update auth user metadata (guaranteed persistence)
      await supabase.auth.updateUser({
        data: { avatar_url: uploadedUrl },
      });

      // 2. Persist to profiles table (with fallback if column doesn't exist yet)
      const pUpdate: any = {
        id: userId,
        full_name: fullName || "User",
        email: email,
        phone: phone,
        avatar_url: uploadedUrl,
        updated_at: new Date().toISOString(),
      };
      const { error: pErr } = await supabase.from("profiles").upsert(pUpdate);
      if (pErr && pErr.message.includes("avatar_url")) {
        delete pUpdate.avatar_url;
        await supabase.from("profiles").upsert(pUpdate);
      }

      // 3. Persist to donors table if donor
      if (donorId) {
        const dUpdate: any = { avatar_url: uploadedUrl, updated_at: new Date().toISOString() };
        const { error: dErr } = await supabase.from("donors").update(dUpdate).eq("id", donorId);
        if (dErr && dErr.message.includes("avatar_url")) {
          delete dUpdate.avatar_url;
          await supabase.from("donors").update(dUpdate).eq("id", donorId);
        }
      }

      toast.success("Profile photo updated successfully!");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to upload photo.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      setAvatarUrl(null);

      await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (donorId) {
        await supabase.from("donors").update({ avatar_url: null }).eq("id", donorId);
      }

      toast.success("Profile photo removed.");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to remove profile photo.");
    } finally {
      setUploadingAvatar(false);
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
          {/* Top Banner */}
          <div className="h-36 bg-gradient-to-r from-red-600 via-rose-500 to-primary relative p-6 flex items-start justify-between">
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
            <div className="relative z-10 flex items-center justify-between w-full">
              <Badge className="bg-white/20 hover:bg-white/30 text-white backdrop-blur border-white/20 text-xs px-3 py-1 font-semibold">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> BloodMap AI Profile
              </Badge>
              {createdAt && (
                <span className="text-xs text-white/90 flex items-center gap-1.5 font-medium bg-black/20 px-3 py-1 rounded-full backdrop-blur">
                  <Calendar className="w-3.5 h-3.5 text-white/80" /> Member since {createdAt}
                </span>
              )}
            </div>
          </div>

          {/* Profile Details Container */}
          <div className="px-6 pb-6 pt-0 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 -mt-16 mb-6">
              {/* Avatar + Main User Details */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left">
                {/* Touchable Profile Avatar */}
                <div className="relative group shrink-0">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    title={avatarUrl ? "Tap to change profile photo" : "Tap to add profile photo"}
                    className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary to-rose-600 border-4 border-background shadow-2xl flex items-center justify-center text-white text-3xl font-extrabold tracking-wider overflow-hidden relative cursor-pointer active:scale-95 hover:shadow-glow transition-all"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-9 h-9 animate-spin text-white" />
                    ) : avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName || "Profile photo"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}

                    {/* Touch / Hover Overlay */}
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-semibold gap-1 backdrop-blur-[2px]">
                      <Camera className="w-6 h-6 text-white" />
                      <span>{avatarUrl ? "Change Photo" : "Add Photo"}</span>
                    </div>
                  </div>

                  {/* Camera Badge Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg border-2 border-background hover:scale-110 active:scale-95 transition-transform"
                    title={avatarUrl ? "Change profile photo" : "Add profile photo"}
                  >
                    <Camera className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* User Text Info & Photo Actions */}
                <div className="space-y-1.5 sm:mb-1">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      {fullName || "User Profile"}
                    </h1>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                    <Mail className="w-4 h-4 text-primary shrink-0" /> {email}
                  </p>

                  {/* Photo Quick Action Buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="h-8 text-xs px-3 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {avatarUrl ? "Change Photo" : "Add Profile Photo"}
                    </Button>

                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar}
                        className="h-8 text-xs px-2.5 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Remove profile photo"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-center sm:justify-end shrink-0">
                {donorId ? (
                  <Badge variant="default" className="bg-gradient-to-r from-red-600 to-rose-500 text-white px-4 py-2 text-sm font-extrabold flex items-center gap-2 shadow-glow rounded-xl">
                    <Droplet className="w-4.5 h-4.5 fill-white text-white" /> Donor ({bloodGroup})
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-xl border border-border">
                    <Heart className="w-4.5 h-4.5 text-primary fill-primary/20" /> Seeker Account
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-5 border-t border-border">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">My Blood Requests</span>
                  <span className="text-base font-bold text-foreground">{myRequestsCount} Request(s)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                  <Droplet className="w-5 h-5 text-rose-500 fill-rose-500" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">Donor Status</span>
                  <span className="text-base font-bold text-foreground">
                    {donorId ? (isAvailable ? "Available 🟢" : "Busy 🔴") : "Not Registered"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground font-semibold block">Contact Phone</span>
                  <span className="text-base font-bold text-foreground truncate block">{phone || "Not set"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Register as Donor Banner for Non-Donors */}
        {!donorId && (
          <div className="rounded-3xl p-6 bg-gradient-to-r from-red-600 via-rose-600 to-primary text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-2 text-center md:text-left relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur">
                <Heart className="w-3.5 h-3.5 fill-white" /> Save Lives in Your Community
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">Become a Registered Donor</h2>
              <p className="text-sm text-white/90 max-w-xl">
                You are currently registered as a Blood Seeker. Registering as a donor allows people in critical emergency need nearby to find your blood group when seconds count.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="bg-white text-red-600 hover:bg-white/90 font-extrabold px-6 py-6 rounded-2xl shadow-lg shrink-0 relative z-10 hover:scale-105 transition-transform"
            >
              <Link to="/donor-setup" className="flex items-center gap-2">
                <Droplet className="w-5 h-5 fill-red-600" />
                Register as a Donor Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* Profile Edit & Address Form */}
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Section 1: My Address */}
          <div className="glass-card rounded-3xl p-6 border border-border shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">My Address Details</h2>
                  <p className="text-xs text-muted-foreground">Add and manage your residential or emergency address</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={detectCurrentLocation}
                disabled={locating}
                className="text-xs font-semibold rounded-xl self-start sm:self-auto"
              >
                {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Compass className="w-3.5 h-3.5 mr-1.5 text-primary" />}
                Auto-Detect Location
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-address" className="font-semibold text-sm">Full Address</Label>
              <Textarea
                id="user-address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street, landmark, city, state, and pincode (e.g. 123 Health Ave, Anna Nagar, Chennai, 600040)"
                className="resize-none rounded-2xl focus:ring-2 focus:ring-primary text-sm p-3.5"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                Your address helps match nearby blood requests and emergency alerts efficiently.
              </p>
            </div>
          </div>

          {/* Section 2: Personal Information */}
          <div className="glass-card rounded-3xl p-6 border border-border shadow-lg space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Personal Information</h2>
                <p className="text-xs text-muted-foreground">Update your personal contact details</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="user-fullname" className="font-semibold text-sm">Full Name</Label>
                <Input
                  id="user-fullname"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="rounded-xl h-11 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-email" className="font-semibold text-sm">Email Address (Account)</Label>
                <Input
                  id="user-email"
                  type="email"
                  disabled
                  value={email}
                  className="bg-muted opacity-80 cursor-not-allowed rounded-xl h-11 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-phone" className="font-semibold text-sm">Phone / WhatsApp Number</Label>
                <Input
                  id="user-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="rounded-xl h-11 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-role" className="font-semibold text-sm">Account Role</Label>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Badge variant={donorId ? "default" : "secondary"} className="px-3.5 py-2 text-xs font-bold rounded-xl">
                    {donorId ? "Registered Donor" : "Blood Seeker (Non-Donor)"}
                  </Badge>
                  {!donorId && (
                    <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-glow">
                      <Link to="/donor-setup" className="flex items-center gap-1.5">
                        <Heart className="w-4 h-4 fill-white" /> Register as a Donor
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Donor Settings (if donor) */}
          {donorId && (
            <div className="glass-card rounded-3xl p-6 border border-border shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Droplet className="w-5 h-5 fill-red-500 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Donor & Availability Settings</h2>
                    <p className="text-xs text-muted-foreground">Manage your donor card details and availability status</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-muted/50 px-3.5 py-1.5 rounded-2xl border border-border">
                  <span className="text-xs font-bold">{isAvailable ? "Available 🟢" : "Busy 🔴"}</span>
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={toggleDonorAvailability}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="donor-bloodgroup" className="font-semibold text-sm">Blood Group</Label>
                  <select
                    id="donor-bloodgroup"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                  >
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donor-emergency" className="font-semibold text-sm">Emergency Contact Number</Label>
                  <Input
                    id="donor-emergency"
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="+91 91234 56789"
                    className="rounded-xl h-11 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start-time" className="font-semibold text-sm">Available From (Time)</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="rounded-xl h-11 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time" className="font-semibold text-sm">Available Until (Time)</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="rounded-xl h-11 text-sm"
                  />
                </div>
              </div>

              {availableDays.length > 0 && (
                <div className="pt-2">
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Active Donation Days</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableDays.map((day) => (
                      <Badge key={day} variant="secondary" className="text-xs rounded-lg px-2.5 py-1 font-medium">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Save Action Bar */}
          <div className="flex items-center justify-between pt-4">
            <Button asChild variant="outline" className="rounded-xl h-11 px-5">
              <Link to="/home">Back to Home</Link>
            </Button>

            <Button type="submit" disabled={saving} size="lg" className="shadow-glow px-8 rounded-xl h-11 font-bold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Profile & Address
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
