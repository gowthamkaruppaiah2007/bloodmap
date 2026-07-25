import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Droplet, HeartHandshake, Search, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Choose how you'll help · BloodMap AI" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  async function choose(type: "seeker" | "donor") {
    setLoading(type);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ user_type: type })
      .eq("id", u.user.id);
    setLoading(null);
    if (error) return toast.error(error.message);
    if (type === "seeker") {
      toast.success("Welcome! Finding nearby donors…");
      navigate({ to: "/home" });
    } else {
      navigate({ to: "/donor-setup" });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 text-primary font-bold text-lg mb-3">
            <Droplet className="w-5 h-5 fill-primary" /> BloodMap AI
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">How will you help today?</h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            You can change this anytime. Donors stay visible on the live map; seekers can request
            blood with one tap.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            icon={<Search className="w-7 h-7" />}
            title="I need blood"
            desc="Search nearby donors on the live map and reach them on WhatsApp instantly."
            cta="Find donors"
            onClick={() => choose("seeker")}
            loading={loading === "seeker"}
            accent="ring-primary/30"
          />
          <Card
            icon={<HeartHandshake className="w-7 h-7" />}
            title="I want to donate"
            desc="Share your blood group and availability so people nearby can find you when it matters."
            cta="Register as donor"
            onClick={() => choose("donor")}
            loading={loading === "donor"}
            accent="ring-primary/40"
            primary
          />
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  desc,
  cta,
  onClick,
  loading,
  primary,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  loading: boolean;
  accent: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`group text-left rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-glow ${
        primary ? "bg-primary text-primary-foreground" : "glass-card"
      }`}
    >
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
          primary ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
        }`}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-bold">{title}</h3>
      <p className={`mt-2 ${primary ? "text-white/80" : "text-muted-foreground"}`}>{desc}</p>
      <div className="mt-8 flex items-center gap-2 font-semibold">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        )}
        {cta}
      </div>
    </button>
  );
}
