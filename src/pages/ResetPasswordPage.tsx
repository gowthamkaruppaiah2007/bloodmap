import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Droplet, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  
  // OTP flow state
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Reset password · BloodMap AI";
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setStep("password");
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setHasSession(true);
        setStep("password");
      }
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return toast.error("Please enter a valid email address.");
    setLoading(true);

    let { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) {
      const retry = await supabase.auth.signInWithOtp({ email: cleanEmail });
      if (!retry.error) error = null;
      else error = retry.error;
    }

    setLoading(false);
    if (error) {
      if (/rate limit/i.test(error.message)) {
        return toast.error("Email rate limit exceeded. Please wait a few minutes or configure Custom SMTP in Supabase.");
      }
      return toast.error(error.message);
    }

    toast.success("6-digit OTP sent! Please check your inbox and Spam folder.", { duration: 6000 });
    setStep("otp");
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanToken = otpToken.trim();
    if (cleanToken.length < 6) {
      return toast.error("Please enter the complete 6-digit OTP code.");
    }
    setLoading(true);

    let { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleanToken,
      type: "recovery",
    });

    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: "email",
      });
      if (!retry.error) error = null;
    }

    setLoading(false);
    if (error) return toast.error(error.message || "Invalid or expired OTP code.");

    toast.success("OTP verified successfully!");
    setHasSession(true);
    setStep("password");
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated successfully. You are signed in!");
    navigate("/home");
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-[var(--gradient-soft)]">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 text-xl font-bold text-primary mb-8 justify-center">
          <Droplet className="w-6 h-6 fill-primary" /> BloodMap AI
        </div>
        <div className="glass-card rounded-2xl p-8">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a strong password you haven't used before.
          </p>

          {!ready ? (
            <div className="mt-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : !hasSession && step === "email" ? (
            <form onSubmit={onSendOtp} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="r-email">Email Address</Label>
                <Input
                  id="r-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" disabled={loading || !email} className="w-full shadow-glow" size="lg">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send 6-Digit OTP
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to sign in
                </Link>
              </Button>
            </form>
          ) : !hasSession && step === "otp" ? (
            <form onSubmit={onVerifyOtp} className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit OTP code to <span className="font-medium text-foreground">{email}</span>.
              </p>
              <div className="space-y-3 flex flex-col items-center">
                <Label htmlFor="r-otp" className="w-full text-left">6-Digit OTP Code</Label>
                <InputOTP
                  id="r-otp"
                  maxLength={6}
                  value={otpToken}
                  onChange={(val) => setOtpToken(val.replace(/\D/g, ""))}
                  containerClassName="justify-center py-2"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-10 h-12 text-lg font-bold text-primary" />
                    <InputOTPSlot index={1} className="w-10 h-12 text-lg font-bold text-primary" />
                    <InputOTPSlot index={2} className="w-10 h-12 text-lg font-bold text-primary" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="w-10 h-12 text-lg font-bold text-primary" />
                    <InputOTPSlot index={4} className="w-10 h-12 text-lg font-bold text-primary" />
                    <InputOTPSlot index={5} className="w-10 h-12 text-lg font-bold text-primary" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-muted-foreground hover:underline"
                >
                  Change Email
                </button>
                <button
                  type="button"
                  onClick={onSendOtp}
                  disabled={loading}
                  className="text-primary font-medium hover:underline disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
              <Button type="submit" disabled={loading || otpToken.length < 6} className="w-full shadow-glow" size="lg">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Verify OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={onSubmitPassword} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="np">New password</Label>
                <Input
                  id="np"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="np2">Confirm password</Label>
                <Input
                  id="np2"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" disabled={loading || !password || !confirm} className="w-full shadow-glow" size="lg">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Update password
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
