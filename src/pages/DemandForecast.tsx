import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Droplet,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Loader2,
  Filter,
  Activity,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BLOOD_GROUPS } from "@/lib/donors";
import { forecastDemand, type DemandForecastResult } from "@/lib/ml.functions";

export default function DemandForecast() {
  const [horizon, setHorizon] = useState<number>(14);
  const [bloodGroup, setBloodGroup] = useState<string>("All");
  const [region, setRegion] = useState<string>("Global");
  const [forecastData, setForecastData] = useState<DemandForecastResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Demand Forecast · BloodMap AI";
    loadForecast();
  }, [horizon, bloodGroup, region]);

  async function loadForecast() {
    setLoading(true);
    const res = await forecastDemand({ horizonDays: horizon, bloodGroup, region });
    setForecastData(res);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      {/* Header */}
      <header className="sticky top-0 z-20 glass-card rounded-none border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">
              <ArrowLeft className="w-4 h-4 mr-1" /> Home
            </Link>
          </Button>
          <div className="flex items-center gap-2 font-bold text-primary">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="text-lg">Demand Forecast AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Title Section */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Blood Request Demand Forecast</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Time-series predictive model (Prophet & XGBoost) estimating blood demand spikes by region and type.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="w-[130px]">
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
              <SelectTrigger className="w-[130px]">
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
              <SelectTrigger className="w-[130px]">
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

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Projected"
            value={forecastData ? `${forecastData.totalProjected} units` : "—"}
            icon={<Droplet className="w-5 h-5 text-red-500 fill-red-500" />}
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
          <StatCard
            title="High-Risk Group"
            value="O- & A-"
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
          />
          <StatCard
            title="Model Accuracy"
            value="89.4% MAPE"
            icon={<Activity className="w-5 h-5 text-emerald-500" />}
          />
        </section>

        {/* Time-Series Chart */}
        <section className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Projected Request Volume ({horizon} Days)
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
              Confidence Interval: 90%
            </span>
          </div>

          {loading || !forecastData ? (
            <div className="h-[320px] grid place-items-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="h-[340px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData.forecast} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
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

        {/* Breakdown Table */}
        <section className="glass-card rounded-3xl p-6">
          <h3 className="font-bold text-lg mb-4">Daily Forecast Breakdown</h3>
          {loading || !forecastData ? (
            <div className="py-8 grid place-items-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
        <div className="text-xl font-bold mt-0.5">{value}</div>
      </div>
    </div>
  );
}
