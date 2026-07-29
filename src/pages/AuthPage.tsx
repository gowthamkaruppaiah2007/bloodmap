import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Droplet, Heart, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");

  useEffect(() => {
    document.title = "Sign in · BloodMap AI";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/home");
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero side */}
      <div className="hidden lg:flex flex-1 gradient-hero text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-black/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xl font-bold font-[var(--font-display)]">
            <Droplet className="w-7 h-7 fill-white" />
            BloodMap AI
          </div>
        </div>
        <div className="relative space-y-6 max-w-md">
          <h1 className="text-5xl font-bold leading-tight">
            Every drop counts. Find donors instantly.
          </h1>
          <p className="text-lg text-white/85">
            Real-time blood donor locator powered by live geolocation. Connect with verified donors
            near you in seconds.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Feature
              icon={<MapPin className="w-4 h-4" />}
              title="Live map"
              body="See donors as live drop markers."
            />
            <Feature
              icon={<Heart className="w-4 h-4" />}
              title="Direct request"
              body="One-tap WhatsApp message."
            />
          </div>
        </div>
        <div className="relative text-sm text-white/70">A community-powered emergency network.</div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 bg-[var(--gradient-soft)]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 text-xl font-bold text-primary mb-8 justify-center">
            <Droplet className="w-6 h-6 fill-primary" /> BloodMap AI
          </div>
          <div className="glass-card rounded-2xl p-8">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm onDone={() => setTab("login")} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/15">
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-sm text-white/75 mt-1">{body}</p>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 3-step OTP Forgot Password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "otp" | "password">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  function resetForgotState() {
    setForgotOpen(false);
    setForgotStep("email");
    setOtpToken("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotLoading(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const ADMIN_EMAIL = "gowthampooncholai@gmail.com";
    const ADMIN_PASSWORD = "9626652426";
    const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;

    let { error } = await supabase.auth.signInWithPassword({
      email: isAdmin ? ADMIN_EMAIL : email,
      password,
    });
    if (error && isAdmin && /invalid/i.test(error.message)) {
      // First-time admin: create the account, then sign in.
      const { error: signUpErr } = await supabase.auth.signUp({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        options: { data: { full_name: "Administrator" } },
      });
      if (signUpErr && !/registered/i.test(signUpErr.message)) {
        setLoading(false);
        return toast.error(signUpErr.message);
      }
      ({ error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }));
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    if (isAdmin) {
      localStorage.setItem("bloodmap_admin", "1");
      toast.success("Welcome, Administrator");
      navigate("/admin");
      return;
    }
    toast.success("Welcome back!");
    navigate("/home");
  }

  // Step 1: Send OTP via Email / SMTP
  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return toast.error("Please enter a valid email address.");
    setForgotLoading(true);

    let { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
    if (error) {
      // Fallback: try signInWithOtp if resetPasswordForEmail returns an issue
      const retry = await supabase.auth.signInWithOtp({ email: forgotEmail.trim() });
      if (!retry.error) error = null;
    }

    setForgotLoading(false);
    if (error) return toast.error(error.message);

    toast.success("6-digit OTP code sent to your email!");
    setForgotStep("otp");
  }

  // Step 2: Verify 6-digit OTP token
  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanToken = otpToken.trim();
    if (cleanToken.length < 6) {
      return toast.error("Please enter the complete 6-digit OTP code.");
    }
    setForgotLoading(true);

    // Try recovery type first
    let { error } = await supabase.auth.verifyOtp({
      email: forgotEmail.trim(),
      token: cleanToken,
      type: "recovery",
    });

    // If recovery type fails, try email type
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: forgotEmail.trim(),
        token: cleanToken,
        type: "email",
      });
      if (!retry.error) error = null;
    }

    setForgotLoading(false);
    if (error) return toast.error(error.message || "Invalid or expired OTP code.");

    toast.success("OTP verified successfully!");
    setForgotStep("password");
  }

  // Step 3: Reset to New Password
  async function onResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters long.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    setForgotLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setForgotLoading(false);

    if (error) return toast.error(error.message);

    toast.success("Password updated successfully! You are now logged in.");
    resetForgotState();
    navigate("/home");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={() => {
              setForgotEmail(email);
              setForgotStep("email");
              setForgotOpen(true);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full shadow-glow" size="lg">
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Login
      </Button>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={resetForgotState}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {forgotStep === "email" && (
              <form onSubmit={onSendOtp} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Reset your password</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your registered email address to receive a 6-digit OTP code via email.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-email">Email Address</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetForgotState}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 shadow-glow"
                    disabled={forgotLoading || !forgotEmail}
                  >
                    {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Send OTP
                  </Button>
                </div>
              </form>
            )}

            {forgotStep === "otp" && (
              <form onSubmit={onVerifyOtp} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Enter Verification Code</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    We sent a 6-digit OTP to <span className="font-medium text-foreground">{forgotEmail}</span>.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-otp">6-Digit OTP Code</Label>
                  <Input
                    id="fp-otp"
                    type="text"
                    required
                    maxLength={6}
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="text-center text-xl tracking-[0.4em] font-mono"
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep("email")}
                    className="text-muted-foreground hover:underline"
                  >
                    Change Email
                  </button>
                  <button
                    type="button"
                    onClick={onSendOtp}
                    disabled={forgotLoading}
                    className="text-primary font-medium hover:underline disabled:opacity-50"
                  >
                    Resend Code
                  </button>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetForgotState}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 shadow-glow"
                    disabled={forgotLoading || otpToken.length < 6}
                  >
                    {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Verify OTP
                  </Button>
                </div>
              </form>
            )}

            {forgotStep === "password" && (
              <form onSubmit={onResetPassword} className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Create New Password</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    OTP verified! Choose a new password for your account.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-new-pw">New Password</Label>
                  <Input
                    id="fp-new-pw"
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fp-confirm-pw">Confirm New Password</Label>
                  <Input
                    id="fp-confirm-pw"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetForgotState}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 shadow-glow"
                    disabled={forgotLoading || !newPassword || !confirmPassword}
                  >
                    {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Save Password
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error("Passwords do not match");
    if (form.password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { full_name: form.fullName, phone: form.phone },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Welcome to BloodMap AI.");
    // If email confirmation is off, user is already logged in.
    const { data } = await supabase.auth.getSession();
    if (data.session) navigate("/onboarding");
    else {
      toast.message("Check your email to confirm and then log in.");
      onDone();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="r-name">Full name</Label>
        <Input
          id="r-name"
          required
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-phone">Phone number</Label>
        <Input
          id="r-phone"
          type="tel"
          required
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder="+1 555 000 0000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-email">Email</Label>
        <Input
          id="r-email"
          type="email"
          required
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="r-pw">Password</Label>
          <Input
            id="r-pw"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-cpw">Confirm</Label>
          <Input
            id="r-cpw"
            type="password"
            required
            minLength={6}
            value={form.confirm}
            onChange={(e) => set("confirm", e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full shadow-glow" size="lg">
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Create account
      </Button>
    </form>
  );
}
