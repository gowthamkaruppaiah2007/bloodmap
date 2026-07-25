import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplet, Heart, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · BloodMap AI" },
      {
        name: "description",
        content: "Log in or create an account to find blood donors near you.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "register">("login");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
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
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

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
      navigate({ to: "/admin" });
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/home" });
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent. Check your inbox.");
    setForgotOpen(false);
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
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Reset your password</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we'll send you a reset link.
            </p>
            <div className="space-y-2 mt-4">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setForgotOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 shadow-glow"
                onClick={onForgot}
                disabled={forgotLoading || !forgotEmail}
              >
                {forgotLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send link
              </Button>
            </div>
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
    if (data.session) navigate({ to: "/onboarding" });
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
