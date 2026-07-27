import { supabase } from "@/integrations/supabase/client";
import { haversineKm } from "@/lib/distance";
import type { Donor } from "@/lib/donors";

export const BLOOD_COMPATIBILITY: Record<string, string[]> = {
  "O-": ["O-"],
  "O+": ["O-", "O+"],
  "A-": ["O-", "A-"],
  "A+": ["O-", "O+", "A-", "A+"],
  "B-": ["O-", "B-"],
  "B+": ["O-", "O+", "B-", "B+"],
  "AB-": ["O-", "A-", "B-", "AB-"],
  "AB+": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
};

export interface ScoredDonor extends Donor {
  matchScore: number; // 0 to 100
  distanceKm: number;
  reasons: string[];
}

export interface ForecastPoint {
  date: string;
  predictedRequests: number;
  lowerBound: number;
  upperBound: number;
}

export interface DemandForecastResult {
  region: string;
  bloodGroup: string;
  horizonDays: number;
  forecast: ForecastPoint[];
  totalProjected: number;
  peakDay: string;
}

// Check if donor blood group can be given to recipient blood group
export function isBloodCompatible(donorGroup: string, recipientGroup: string): boolean {
  const allowedDonors = BLOOD_COMPATIBILITY[recipientGroup] || [];
  return allowedDonors.includes(donorGroup);
}

// Fallback deterministic scorer when Python ML service is unreachable
export function rankDonorsFallback(
  recipientBloodGroup: string,
  targetLat: number,
  targetLng: number,
  donors: Donor[],
): ScoredDonor[] {
  return donors
    .map((donor) => {
      const distKm = haversineKm({ lat: targetLat, lng: targetLng }, { lat: donor.latitude, lng: donor.longitude });
      const compatible = isBloodCompatible(donor.blood_group, recipientBloodGroup);
      const exactMatch = donor.blood_group === recipientBloodGroup;

      let score = 0;
      const reasons: string[] = [];

      // Blood compatibility score (0-50 pts)
      if (exactMatch) {
        score += 50;
        reasons.push(`Exact blood match (${donor.blood_group})`);
      } else if (compatible) {
        score += 35;
        reasons.push(`Compatible blood type (${donor.blood_group})`);
      } else {
        score += 0;
        reasons.push(`Incompatible blood group`);
      }

      // Distance score (0-40 pts)
      if (distKm <= 2) {
        score += 40;
        reasons.push("Very close (<2 km)");
      } else if (distKm <= 5) {
        score += 30;
        reasons.push("Nearby (2–5 km)");
      } else if (distKm <= 15) {
        score += 20;
        reasons.push("Within 15 km");
      } else if (distKm <= 30) {
        score += 10;
        reasons.push("Within 30 km");
      } else {
        score += 5;
        reasons.push(`Farther away (${distKm.toFixed(1)} km)`);
      }

      // Availability score (0-10 pts)
      if (donor.is_available) {
        score += 10;
        reasons.push("Currently available");
      }

      return {
        ...donor,
        matchScore: Math.min(100, Math.round(score)),
        distanceKm: Number(distKm.toFixed(2)),
        reasons,
      };
    })
    .filter((d) => isBloodCompatible(d.blood_group, recipientBloodGroup))
    .sort((a, b) => b.matchScore - a.matchScore || a.distanceKm - b.distanceKm);
}

// Match donors for a blood request via ML API or Fallback
export async function matchDonorsForRequest(params: {
  requestId: string;
  bloodGroup: string;
  latitude: number;
  longitude: number;
}): Promise<ScoredDonor[]> {
  const mlApiUrl = import.meta.env.VITE_ML_API_URL;
  const mlApiKey = import.meta.env.VITE_ML_API_KEY;

  // 1. Fetch available donors from database
  const { data: rawDonors, error } = await supabase.rpc("get_available_donors");
  if (error || !rawDonors) {
    console.error("Error fetching donors:", error);
    return [];
  }
  const donors = rawDonors as Donor[];

  // 2. Try external ML Service if configured
  if (mlApiUrl) {
    try {
      const startTime = performance.now();
      const res = await fetch(`${mlApiUrl}/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(mlApiKey ? { Authorization: `Bearer ${mlApiKey}` } : {}),
        },
        body: JSON.stringify({
          request_id: params.requestId,
          blood_group: params.bloodGroup,
          latitude: params.latitude,
          longitude: params.longitude,
          donors: donors.map((d) => ({
            id: d.id,
            blood_group: d.blood_group,
            latitude: d.latitude,
            longitude: d.longitude,
            is_available: d.is_available,
            available_days: d.available_days,
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const latencyMs = Math.round(performance.now() - startTime);

        // Audit prediction log
        logPrediction({
          modelName: json.model_name || "xgboost_ltr",
          modelVersion: json.model_version || "1.0.0",
          inputHash: params.requestId,
          output: json,
          latencyMs,
        });

        // Merge ML scores with local donor detail
        const scoreMap = new Map<string, { score: number; reasons: string[] }>(
          json.ranked_donors.map((rd: { id: string; score: number; reasons: string[] }) => [
            rd.id,
            { score: rd.score, reasons: rd.reasons },
          ]),
        );

        return donors
          .filter((d) => scoreMap.has(d.id))
          .map((d) => {
            const mlInfo = scoreMap.get(d.id)!;
            const distKm = haversineKm(
              { lat: params.latitude, lng: params.longitude },
              { lat: d.latitude, lng: d.longitude },
            );
            return {
              ...d,
              matchScore: Math.round(mlInfo.score),
              distanceKm: Number(distKm.toFixed(2)),
              reasons: mlInfo.reasons,
            };
          })
          .sort((a, b) => b.matchScore - a.matchScore);
      }
    } catch (err) {
      console.warn("[ML Service] ML endpoint unreachable, falling back to deterministic ranker:", err);
    }
  }

  // 3. Fallback deterministic scoring
  return rankDonorsFallback(params.bloodGroup, params.latitude, params.longitude, donors);
}

// Demand forecasting helper
export async function forecastDemand(params: {
  region?: string;
  bloodGroup?: string;
  horizonDays?: number;
}): Promise<DemandForecastResult> {
  const horizon = params.horizonDays || 14;
  const bloodGroup = params.bloodGroup || "All";
  const region = params.region || "Global";

  const mlApiUrl = import.meta.env.VITE_ML_API_URL;
  const mlApiKey = import.meta.env.VITE_ML_API_KEY;

  if (mlApiUrl) {
    try {
      const res = await fetch(`${mlApiUrl}/forecast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(mlApiKey ? { Authorization: `Bearer ${mlApiKey}` } : {}),
        },
        body: JSON.stringify({
          region,
          blood_group: bloodGroup,
          horizon_days: horizon,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        return {
          region: json.region,
          bloodGroup: json.blood_group,
          horizonDays: json.horizon_days,
          forecast: json.forecast,
          totalProjected: json.total_projected,
          peakDay: json.peak_day,
        };
      }
    } catch (err) {
      console.warn("[ML Service] Forecast endpoint unreachable, producing baseline forecast:", err);
    }
  }

  // Baseline forecast generator
  const forecast: ForecastPoint[] = [];
  const today = new Date();
  let totalProjected = 0;
  let maxVal = -1;
  let peakDay = "";

  for (let i = 1; i <= horizon; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    // Synthetic deterministic baseline model
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 8 : 14;
    const noise = Math.sin(i * 0.7) * 3;
    const predicted = Math.max(1, Math.round(base + noise));
    const lower = Math.max(0, Math.round(predicted * 0.75));
    const upper = Math.round(predicted * 1.3);

    totalProjected += predicted;
    if (predicted > maxVal) {
      maxVal = predicted;
      peakDay = dateStr;
    }

    forecast.push({
      date: dateStr,
      predictedRequests: predicted,
      lowerBound: lower,
      upperBound: upper,
    });
  }

  return {
    region,
    bloodGroup,
    horizonDays: horizon,
    forecast,
    totalProjected,
    peakDay,
  };
}

// Prediction logger
export async function logPrediction(params: {
  modelName: string;
  modelVersion: string;
  inputHash: string;
  output: Record<string, unknown>;
  latencyMs: number;
}) {
  try {
    await supabase.from("ml_predictions").insert({
      model_name: params.modelName,
      model_version: params.modelVersion,
      input_hash: params.inputHash,
      output: params.output as unknown as import("@/integrations/supabase/types").Json,
      latency_ms: params.latencyMs,
    });
  } catch (err) {
    console.error("Failed to log ML prediction:", err);
  }
}
