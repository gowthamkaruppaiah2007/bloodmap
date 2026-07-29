import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Droplet,
  FileText,
  TrendingUp,
  LogOut,
  Menu,
  X,
  User,
  Heart,
  Home as HomeIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileType, setProfileType] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email ?? null);
        const { data: p } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", data.user.id)
          .maybeSingle();
        setProfileType(p?.user_type ?? null);
      }
    })();
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/auth");
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 glass-card border-x-0 border-t-0 rounded-none shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand logo & title */}
        <Link to="/home" className="flex items-center gap-2 font-extrabold text-primary hover:opacity-90 transition">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-glow">
            <Droplet className="w-5 h-5 fill-primary text-primary" />
          </div>
          <span className="text-xl tracking-tight">BloodMap AI</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5">
          <Button
            asChild
            variant={isActive("/home") ? "secondary" : "ghost"}
            size="sm"
            className="font-medium"
          >
            <Link to="/home">
              <HomeIcon className="w-4 h-4 mr-1.5 text-primary" /> Home
            </Link>
          </Button>

          <Button
            asChild
            variant={isActive("/requests") ? "secondary" : "ghost"}
            size="sm"
            className="font-medium"
          >
            <Link to="/requests">
              <FileText className="w-4 h-4 mr-1.5 text-primary" /> Blood Requests
            </Link>
          </Button>

          <Button
            asChild
            variant={isActive("/forecast") ? "secondary" : "ghost"}
            size="sm"
            className="font-medium"
          >
            <Link to="/forecast">
              <TrendingUp className="w-4 h-4 mr-1.5 text-primary" /> Forecast AI
            </Link>
          </Button>

          {userEmail && (
            <Button
              asChild
              variant={isActive("/profile") ? "secondary" : "ghost"}
              size="sm"
              className="font-medium"
            >
              <Link to="/profile">
                <User className="w-4 h-4 mr-1.5 text-primary" /> Profile
              </Link>
            </Button>
          )}

          {profileType === "seeker" && (
            <Button asChild variant="outline" size="sm" className="border-primary/40 text-primary font-semibold">
              <Link to="/donor-setup">
                <Heart className="w-4 h-4 mr-1.5 text-red-500 fill-red-500" /> Become a Donor
              </Link>
            </Button>
          )}

          {userEmail ? (
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-1.5" /> Sign out
            </Button>
          ) : (
            <Button asChild variant="default" size="sm" className="shadow-glow">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation Menu"
            className="w-10 h-10 rounded-xl"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-md px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200">
          <div className="space-y-1">
            <Link
              to="/home"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-base transition ${
                isActive("/home") ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
              }`}
            >
              <HomeIcon className="w-5 h-5 text-primary" /> Home
            </Link>

            <Link
              to="/requests"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-base transition ${
                isActive("/requests") ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
              }`}
            >
              <FileText className="w-5 h-5 text-primary" /> Blood Requests
            </Link>

            <Link
              to="/forecast"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-base transition ${
                isActive("/forecast") ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
              }`}
            >
              <TrendingUp className="w-5 h-5 text-primary" /> Forecast AI
            </Link>

            {userEmail && (
              <Link
                to="/profile"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-base transition ${
                  isActive("/profile") ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                <User className="w-5 h-5 text-primary" /> My Profile & Address
              </Link>
            )}

            {profileType === "seeker" && (
              <Link
                to="/donor-setup"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition"
              >
                <Heart className="w-5 h-5 text-red-500 fill-red-500" /> Become a Donor
              </Link>
            )}
          </div>

          <div className="pt-3 border-t flex flex-col gap-2">
            {userEmail && (
              <div className="px-3 text-xs text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="truncate">{userEmail}</span>
              </div>
            )}

            {userEmail ? (
              <Button onClick={handleLogout} variant="outline" className="w-full justify-center text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            ) : (
              <Button asChild className="w-full shadow-glow">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
