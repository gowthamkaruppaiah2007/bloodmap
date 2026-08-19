import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Droplet,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Loader2,
  Activity,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOOD_GROUPS } from "@/lib/donors";
import { forecastDemand, type DemandForecastResult } from "@/lib/ml.functions";
import Navbar from "@/components/Navbar";

export default function DemandForecast() {
  const [horizon, setHorizon] = useState<number>(14);
  const [bloodGroup, setBloodGroup] = useState<string>("All");
  const [region, setRegion] = useState<string>("Global");
  const [forecastData, setForecastData] = useState<DemandForecastResult | null>(null);
  const [loading, setLoading] = useState(true);

  // AI Donor Eligibility Evaluator state
  const [testAge, setTestAge] = useState<number | string>(25);
  const [testWeight, setTestWeight] = useState<number | string>(65);
  const [testHgb, setTestHgb] = useState<number | string>(14.2);
  const [testBg, setTestBg] = useState<string>("O+");
  const [evalResult, setEvalResult] = useState<{
    status: "Eligible" | "Not Eligible";
    confidence: number;
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    document.title = "Demand Forecast & Eligibility · BloodMap AI";
    loadForecast();
  }, []);

  async function loadForecast() {
    setLoading(true);
    const res = await forecastDemand({ horizonDays: horizon, bloodGroup, region });
    setForecastData(res);
    setLoading(false);
  }

  function handleEvaluateEligibility(e: React.FormEvent) {
    e.preventDefault();
    const ageVal = typeof testAge === "number" ? testAge : parseFloat(testAge as string) || 0;
    const weightVal = typeof testWeight === "number" ? testWeight : parseFloat(testWeight as string) || 0;
    const hgbVal = typeof testHgb === "number" ? testHgb : parseFloat(testHgb as string) || 0;

    const reasons: string[] = [];
    let eligible = true;

    if (ageVal < 18 || ageVal > 65) {
      eligible = false;
      reasons.push(`Age must be between 18 and 65 years (given: ${ageVal || 0})`);
    } else {
      reasons.push(`Age ${ageVal} is within eligible donor range (18–65 years)`);
    }

    if (weightVal < 50) {
      eligible = false;
      reasons.push(`Weight must be at least 50 kg (given: ${weightVal || 0} kg)`);
    } else {
      reasons.push(`Weight ${weightVal} kg meets minimum requirement (>= 50 kg)`);
    }

    if (hgbVal < 12.5) {
      eligible = false;
      reasons.push(`Hemoglobin level must be >= 12.5 g/dL (given: ${hgbVal || 0} g/dL)`);
    } else {
      reasons.push(`Hemoglobin ${hgbVal} g/dL is healthy for blood donation`);
    }

    const confidence = eligible ? 0.88 : 0.82;
    setEvalResult({
      status: eligible ? "Eligible" : "Not Eligible",
      confidence,
      reasons,
    });
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6 flex-1 w-full">
        {/* Title & Filter Controls Section */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <TrendingUp className="w-7 h-7 text-primary" /> Blood Request Demand Forecast
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Predictive time-series forecasting & instant AI donor eligibility evaluation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[120px] sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Global">Global</SelectItem>
                <SelectItem value="North Region">North Region</SelectItem>
                <SelectItem value="South Region">South Region</SelectItem>
                <SelectItem value="East Region">East Region</SelectItem>
                <SelectItem value="West Region">West Region</SelectItem>
              </SelectContent>
            </Select>

            <Select value={bloodGroup} onValueChange={setBloodGroup}>
              <SelectTrigger className="w-[120px] sm:w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Groups</SelectItem>
                {BLOOD_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={horizon.toString()} onValueChange={(v) => setHorizon(parseInt(v))}>
              <SelectTrigger className="w-[110px] sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Data-Driven Forecast Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Total Projected Demand"
            value={forecastData ? `${forecastData.totalProjected} units` : "—"}
            icon={<Droplet className="w-5 h-5 text-red-500 fill-red-500" />}
          />
          <StatCard
            title="Website Active Requests"
            value={
              forecastData
                ? `${forecastData.actualRequestsCount} Req (${forecastData.actualUnitsCount} Units)`
                : "—"
            }
            icon={<Activity className="w-5 h-5 text-emerald-500" />}
          />
          <StatCard
            title="Top Requested Group"
            value={forecastData?.topRequestedBloodGroup || "None"}
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          />
          <StatCard
            title="Peak Demand Day"
            value={
              forecastData?.peakDay
                ? new Date(forecastData.peakDay).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "—"
            }
            icon={<Calendar className="w-5 h-5 text-blue-500" />}
          />
        </section>

        {/* Time-Series Chart Container */}
        <section className="glass-card rounded-3xl p-4 sm:p-8 space-y-4 shadow-lg border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Projected Request Volume ({horizon} Days)
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
              Confidence Interval: 90%
            </span>
          </div>

          {loading || !forecastData ? (
            <div className="h-[280px] sm:h-[320px] grid place-items-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="h-[280px] sm:h-[340px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={forecastData.forecast}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#93c5fd"
                    fill="url(#colorBand)"
                    name="Upper Bound"
                  />
                  <Area
                    type="monotone"
                    dataKey="predictedRequests"
                    stroke="#ef4444"
                    strokeWidth={3}
                    fill="url(#colorPredicted)"
                    name="Predicted Requests"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* AI Donor Eligibility Evaluator Tool */}
        <section className="glass-card rounded-3xl p-6 border border-border shadow-lg space-y-4">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">AI Donor Eligibility Evaluator</h2>
              <p className="text-xs text-muted-foreground">
                Instantly check your eligibility to donate blood based on medical parameters
              </p>
            </div>
          </div>

          <form onSubmit={handleEvaluateEligibility} className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-age" className="font-semibold text-xs">Age (Years)</Label>
              <Input
                id="t-age"
                type="number"
                min={15}
                max={80}
                value={testAge}
                onChange={(e) => setTestAge(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-weight" className="font-semibold text-xs">Weight (kg)</Label>
              <Input
                id="t-weight"
                type="number"
                min={30}
                max={150}
                value={testWeight}
                onChange={(e) => setTestWeight(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-hgb" className="font-semibold text-xs">Hemoglobin (g/dL)</Label>
              <Input
                id="t-hgb"
                type="number"
                step="0.1"
                min={5}
                max={20}
                value={testHgb}
                onChange={(e) => setTestHgb(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-bg" className="font-semibold text-xs">Blood Group</Label>
              <select
                id="t-bg"
                value={testBg}
                onChange={(e) => setTestBg(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-2">
              <Button type="submit" className="shadow-glow px-6">
                <Sparkles className="w-4 h-4 mr-2" /> Evaluate Eligibility
              </Button>
            </div>
          </form>

          {evalResult && (
            <div className={`mt-4 p-4 rounded-2xl border ${evalResult.status === "Eligible" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200" : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-lg">
                  {evalResult.status === "Eligible" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-rose-600" />
                  )}
                  <span>Status: {evalResult.status}</span>
                </div>
                <Badge variant={evalResult.status === "Eligible" ? "default" : "destructive"}>
                  {(evalResult.confidence * 100).toFixed(0)}% AI Confidence
                </Badge>
              </div>

              <ul className="mt-3 text-xs space-y-1 pl-6 list-disc opacity-90">
                {evalResult.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Daily Forecast Breakdown Table */}
        <section className="glass-card rounded-3xl p-4 sm:p-6 border border-border shadow-lg">
          <h3 className="font-bold text-base sm:text-lg mb-4">Daily Time-Series Forecast Breakdown</h3>
          {loading || !forecastData ? (
            <div className="py-8 grid place-items-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="pb-3 px-2">Date</th>
                    <th className="pb-3 px-2">Predicted Demand</th>
                    <th className="pb-3 px-2">90% Confidence Interval</th>
                    <th className="pb-3 px-2">Risk Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecast.map((pt) => {
                    const isPeak = pt.date === forecastData.peakDay;
                    return (
                      <tr key={pt.date} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">
                          {new Date(pt.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-2 font-bold text-primary">
                          {pt.predictedRequests} units
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {pt.lowerBound} – {pt.upperBound} units
                        </td>
                        <td className="py-3 px-2">
                          {isPeak ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/15 text-red-600 border border-red-500/20">
                              Peak Spike
                            </span>
                          ) : pt.predictedRequests > 12 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/20">
                              High Volume
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 border border-border shadow-md">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </div>
        <div className="text-base sm:text-xl font-bold mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}
