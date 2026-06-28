export type UserRole = 'driver' | 'admin';
export type UserPlan = 'free' | 'pro' | 'pro_plus';

export interface Profile {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  plan: UserPlan;
  created_at: string;
  is_blocked?: boolean;
  beta_tester?: boolean;
  onboarding_completed?: boolean;
  last_access?: string;
}

export type OwnershipType = 'own' | 'rented' | 'financed';

export interface Vehicle {
  id?: string;
  user_id: string;
  brand: string;
  model: string;
  year: number;
  plate_optional?: string;
  fuel_type: string;
  km_per_liter: number;
  ownership_type: OwnershipType;
  weekly_km_limit?: number;
  monthly_km_limit?: number;
  rental_amount?: number;
  rental_period?: 'weekly' | 'monthly';
  rental_food_daily?: number;
  rental_damage_monthly?: number;
  rental_cleaning_monthly?: number;
  electric_consumption_kwh_100km?: number;
  electricity_price_kwh?: number;
  charging_type?: 'residential' | 'public' | 'mixed' | null;
  home_electricity_price_kwh?: number;
  public_electricity_price_kwh?: number;
  home_charging_percent?: number;
  public_charging_percent?: number;
  battery_replacement_cost?: number;
  battery_life_km?: number;
  created_at?: string;
}

export type PlatformType = 'uber' | '99' | 'indriver' | 'private' | 'other';

export interface Earning {
  id?: string;
  user_id: string;
  date: string;
  platform: PlatformType;
  gross_amount: number;
  total_km: number;
  passenger_km: number;
  empty_km: number;
  online_minutes: number;
  waiting_minutes: number;
  rides_count: number;
  notes?: string;
  entry_mode?: 'single_ride' | 'shift_close';
  shift_period?: 'morning' | 'afternoon' | 'night' | 'dawn' | 'full_day' | null;
  closure_reported_gross_amount?: number;
  closure_deducted_single_rides_amount?: number;
  created_at?: string;
}

export type ExpenseType = 
  | 'fuel' 
  | 'food' 
  | 'maintenance' 
  | 'rent' 
  | 'financing' 
  | 'ipva' 
  | 'license' 
  | 'insurance' 
  | 'cleaning' 
  | 'tires' 
  | 'oil' 
  | 'brakes' 
  | 'other';

export interface Expense {
  id?: string;
  user_id: string;
  date: string;
  type: ExpenseType;
  amount: number;
  description?: string;
  created_at?: string;
}

export interface DailyClosing {
  id?: string;
  user_id: string;
  date: string;
  gross_amount: number;
  total_expenses: number;
  net_profit: number;
  total_km: number;
  cost_per_km: number;
  profit_per_km: number;
  created_at?: string;
}

export interface WeeklyClosing {
  id?: string;
  user_id: string;
  week_start: string;
  week_end: string;
  gross_amount: number;
  total_expenses: number;
  net_profit: number;
  total_km: number;
  cost_per_km: number;
  profit_per_km: number;
  created_at?: string;
}

export interface AdminPeakRule {
  id?: string;
  title: string;
  region: string;
  start_time: string;
  end_time: string;
  days_of_week: string[]; // e.g. ["Mon", "Tue"] or ["0", "6"]
  demand_level: 'low' | 'medium' | 'high' | 'extreme';
  source_type: 'admin' | 'manual' | 'api';
  is_active: boolean;
  created_at?: string;
}

export interface PassengerReport {
  id?: string;
  user_id: string; // reporting driver
  title: string;
  description: string;
  region: string;
  severity: 'low' | 'medium' | 'high';
  created_at?: string;
}

export interface FinancialGoal {
  id?: string;
  user_id: string;
  daily_goal: number;
  weekly_goal: number;
  monthly_goal: number;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleCostSettings {
  id?: string;
  user_id: string;
  fuel_price: number;
  tire_cost: number;
  tire_lifespan_km: number;
  oil_change_cost: number;
  oil_change_interval_km: number;
  brake_cost: number;
  brake_interval_km: number;
  insurance_yearly: number;
  ipva_yearly: number;
  licensing_yearly: number;
  emergency_reserve_monthly: number;
  financing_monthly?: number;
  maintenance_monthly?: number;
  created_at?: string;
}

export interface SmartAlert {
  id?: string;
  user_id?: string;
  type: 'goal' | 'fuel' | 'profit' | 'rental';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  is_read: boolean;
  is_archived?: boolean;
  created_at?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: UserPlan;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  plan: UserPlan;
  payment_method: string;
  transaction_reference?: string;
  created_at: string;
  approved_at?: string;
}

// Future GPS / Telemetry Architectural structure placeholders
export interface DriverSession {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'completed';
  total_distance_km?: number;
  total_duration_minutes?: number;
  created_at: string;
}

export interface RoutePoint {
  id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  recorded_at: string;
}

export interface DemandSignal {
  id: string;
  title: string;
  region: string;
  latitude: number;
  longitude: number;
  signal_type: string;
  weight: number;
  start_at?: string;
  end_at?: string;
  is_active: boolean;
}

export interface UberPassSettings {
  id?: string;
  user_id: string;
  pass_type: string;
  pass_price: number;
  earnings_limit?: number;
  old_fee_percent: number;
  target_profit_per_hour: number;
  target_daily_revenue: number;
  planned_hours: number;
  average_ticket: number;
  cost_per_km: number;
  estimated_km: number;
  created_at?: string;
  updated_at?: string;
}
