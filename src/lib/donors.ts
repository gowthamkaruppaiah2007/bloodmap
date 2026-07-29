export interface Donor {
  id: string;
  user_id: string;
  full_name: string;
  blood_group: string;
  whatsapp_number: string;
  latitude: number;
  longitude: number;
  available_days: string[];
  start_time: string | null;
  end_time: string | null;
  is_available: boolean;
  emergency_contact?: string | null;
  address?: string | null;
  updated_at: string;
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;
