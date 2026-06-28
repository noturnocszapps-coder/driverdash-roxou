/**
 * App Unified Modular Context Bridge
 * Replaces the monolithic AppContext with isolated hooks and modular services.
 * When to edit: When adding a global state shared between separate modules, or modifying legacy adapters.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../modules/shared/supabase.helpers';
import { STORAGE_PREFIX } from '../modules/shared/constants';
import { Profile, UserRole, UserPlan, Vehicle, Earning, Expense, DailyClosing, WeeklyClosing, AdminPeakRule, PassengerReport, FinancialGoal, VehicleCostSettings, SmartAlert, Subscription, Payment, DriverSession, RoutePoint } from '../types';

import { AuthProvider, useAuth } from '../modules/auth/auth.hooks';
import { FinanceProvider, useFinance } from '../modules/finance/finance.hooks';
import { VehicleProvider, useVehicle } from '../modules/vehicle/vehicle.hooks';
import { GoalsProvider, useGoals } from '../modules/goals/goals.hooks';
import { InsightsProvider, useInsights } from '../modules/insights/insights.hooks';
import { SubscriptionsProvider, useSubscriptions } from '../modules/subscriptions/subscriptions.hooks';
import { JourneyProvider, useJourney } from '../modules/journey/journey.hooks';
import { DemandProvider, useDemand } from '../modules/demand/demand.hooks';
import { AlertsProvider, useAlerts } from '../modules/alerts/alerts.hooks';

interface AppContextType {
  user: any | null;
  profile: Profile | null;
  vehicle: Vehicle | null;
  earnings: Earning[];
  expenses: Expense[];
  dailyClosings: DailyClosing[];
  weeklyClosings: WeeklyClosing[];
  peakRules: AdminPeakRule[];
  passengerReports: PassengerReport[];
  financialGoal: FinancialGoal | null;
  vehicleCostSettings: VehicleCostSettings | null;
  smartAlerts: SmartAlert[];
  driverSessions: DriverSession[];
  routePoints: RoutePoint[];
  unsyncedPointsCount: number;
  syncOfflineQueue: () => Promise<number>;
  
  // Admin & Billing states
  users: Profile[];
  subscriptions: Subscription[];
  payments: Payment[];
  
  loading: boolean;
  dbStatus: 'connected' | 'fallback' | 'checking';
  errorMessage: string | null;
  
  // Auth actions
  loginWithGoogle: () => Promise<void>;
  loginWithEmailAndPassword: (email: string, password: string) => Promise<void>;
  localDemoLogin: (role: UserRole) => void;
  logout: () => Promise<void>;
  
  // DB actions
  upsertVehicle: (vehicleData: Omit<Vehicle, 'user_id' | 'id'>) => Promise<void>;
  upsertFinancialGoal: (goalData: Omit<FinancialGoal, 'user_id' | 'id'>) => Promise<void>;
  upsertVehicleCostSettings: (costData: Omit<VehicleCostSettings, 'user_id' | 'id'>) => Promise<void>;
  addEarning: (earningData: Omit<Earning, 'user_id' | 'id'>) => Promise<void>;
  addExpense: (expenseData: Omit<Expense, 'user_id' | 'id'>) => Promise<void>;
  deleteEarning: (id: string | undefined, indexLocal: number) => Promise<void>;
  deleteExpense: (id: string | undefined, indexLocal: number) => Promise<void>;
  createDailyClosing: (date: string) => Promise<DailyClosing>;
  createWeeklyClosing: (start: string, end: string) => Promise<WeeklyClosing>;
  addPeakRule: (rule: Omit<AdminPeakRule, 'id'>) => Promise<void>;
  togglePeakRule: (id: string | undefined, indexLocal: number) => Promise<void>;
  addPassengerReport: (report: Omit<PassengerReport, 'user_id' | 'id'>) => Promise<void>;
  markAlertAsRead: (id: string | undefined, indexLocal: number) => Promise<void>;
  archiveAlert: (id: string | undefined, indexLocal: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  startSession: () => Promise<void>;
  endSession: (sessionId: string, totalDistanceKm: number, totalDurationMinutes: number) => Promise<void>;
  addRoutePoint: (point: Omit<RoutePoint, 'id' | 'recorded_at'>) => Promise<void>;
  addSmartAlert: (alertData: { type: 'goal' | 'fuel' | 'profit' | 'rental'; title: string; description: string; severity: 'low' | 'medium' | 'high' }) => Promise<void>;
  
  // Commercial & admin updates
  updateUserPlan: (userId: string, plan: UserPlan) => Promise<void>;
  updateSubscriptionStatus: (userId: string, plan: UserPlan, status: 'active' | 'inactive' | 'pending') => Promise<void>;
  toggleUserRole: (userId: string) => Promise<void>;
  toggleBlockUser: (userId: string) => Promise<void>;
  toggleBetaTester: (userId: string) => Promise<void>;
  requestUpgrade: (plan: UserPlan) => Promise<void>;
  approvePayment: (paymentId: string) => Promise<void>;
  rejectPayment: (paymentId: string) => Promise<void>;
  
  // Computed financial stats
  metrics: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    totalKm: number;
    costPerKm: number;
    profitPerKm: number;
    ridesCount: number;
    onlineMinutes: number;
    waitingMinutes: number;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LegacyAppBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const finance = useFinance();
  const vehicle = useVehicle();
  const goals = useGoals();
  const insights = useInsights();
  const subscriptions = useSubscriptions();
  const journey = useJourney();
  const alerts = useAlerts();

  const [users, setUsers] = useState<Profile[]>([]);
  const [errorMessage] = useState<string | null>(null);

  // Sync users (System Profiles) for administration panel
  useEffect(() => {
    if (!auth.user) {
      setUsers([]);
      return;
    }

    const loadLocalUsers = () => {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}users`);
      setUsers(stored ? JSON.parse(stored) : []);
    };

    if (auth.dbStatus === 'connected' && auth.profile?.role === 'admin') {
      const loadRemoteUsers = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (data) {
            setUsers(data);
            localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(data));
          }
        } catch (e) {
          console.warn('System profiles administrative read failed:', e);
          loadLocalUsers();
        }
      };
      loadRemoteUsers();
    } else {
      loadLocalUsers();
    }
  }, [auth.user, auth.dbStatus, auth.profile?.role]);

  const completeOnboarding = async () => {
    if (!auth.profile) return;
    const updatedProfile = { ...auth.profile, onboarding_completed: true };
    
    if (auth.dbStatus === 'connected') {
      try {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', auth.profile.id);
      } catch (e) {
        console.error("Error setting onboarding completed in Supabase:", e);
      }
    }

    auth.setProfileState(updatedProfile);
    localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updatedProfile));

    const updatedUsers = users.map(u => u.id === auth.profile?.id ? { ...u, onboarding_completed: true } : u);
    setUsers(updatedUsers);
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(updatedUsers));
  };

  const toggleUserRole = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const newRole: UserRole = targetUser.role === 'admin' ? 'driver' : 'admin';

    if (auth.dbStatus === 'connected') {
      try {
        await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
      } catch (e) {
        console.error("Supabase error during toggleUserRole:", e);
      }
    }

    if (auth.profile && auth.profile.id === userId) {
      const updatedProfile = { ...auth.profile, role: newRole };
      auth.setProfileState(updatedProfile);
      localStorage.setItem(`${STORAGE_PREFIX}profile`, JSON.stringify(updatedProfile));
    }

    const updatedUsers = users.map(u => u.id === userId ? { ...u, role: newRole } : u);
    setUsers(updatedUsers);
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(updatedUsers));
  };

  const toggleBlockUser = async (userId: string) => {
    if (auth.profile && auth.profile.id === userId) {
      alert("Você não pode bloquear a si próprio!");
      return;
    }

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const newBlockState = !targetUser.is_blocked;

    if (auth.dbStatus === 'connected') {
      try {
        await supabase
          .from('profiles')
          .update({ is_blocked: newBlockState })
          .eq('id', userId);
      } catch (e) {
        console.error("Supabase error during toggleBlockUser:", e);
      }
    }

    const updatedUsers = users.map(u => u.id === userId ? { ...u, is_blocked: newBlockState } : u);
    setUsers(updatedUsers);
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(updatedUsers));
  };

  const toggleBetaTester = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const newBetaState = !targetUser.beta_tester;

    if (auth.dbStatus === 'connected') {
      try {
        await supabase
          .from('profiles')
          .update({ beta_tester: newBetaState })
          .eq('id', userId);
      } catch (e) {
        console.error("Supabase error during toggleBetaTester:", e);
      }
    }

    const updatedUsers = users.map(u => u.id === userId ? { ...u, beta_tester: newBetaState } : u);
    setUsers(updatedUsers);
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(updatedUsers));
  };

  const updateUserPlan = async (userId: string, plan: UserPlan) => {
    await subscriptions.updateSubscriptionStatus(userId, plan, 'active');
    const updatedUsers = users.map(u => u.id === userId ? { ...u, plan } : u);
    setUsers(updatedUsers);
    localStorage.setItem(`${STORAGE_PREFIX}users`, JSON.stringify(updatedUsers));
  };

  const markAlertAsRead = async (id: string | undefined, indexLocal: number) => {
    const targetId = id || alerts.smartAlerts[indexLocal]?.id;
    if (targetId) await alerts.dismissAlert(targetId);
  };

  const archiveAlert = async (id: string | undefined, indexLocal: number) => {
    const targetId = id || alerts.smartAlerts[indexLocal]?.id;
    if (targetId) await alerts.dismissAlert(targetId);
  };

  return (
    <AppContext.Provider
      value={{
        user: auth.user,
        profile: auth.profile,
        vehicle: vehicle.vehicle,
        earnings: finance.earnings,
        expenses: finance.expenses,
        dailyClosings: finance.dailyClosings,
        weeklyClosings: finance.weeklyClosings,
        peakRules: insights.peakRules,
        passengerReports: insights.passengerReports,
        financialGoal: goals.financialGoal,
        vehicleCostSettings: vehicle.vehicleCostSettings,
        smartAlerts: alerts.smartAlerts,
        driverSessions: journey.driverSessions,
        routePoints: journey.routePoints,
        unsyncedPointsCount: journey.unsyncedPointsCount,
        syncOfflineQueue: journey.syncOfflineQueue,

        users,
        subscriptions: subscriptions.subscriptions,
        payments: subscriptions.payments,

        loading: auth.loading,
        dbStatus: auth.dbStatus,
        errorMessage,

        // Auth delegators
        loginWithGoogle: auth.loginWithGoogle,
        loginWithEmailAndPassword: auth.loginWithEmailAndPassword,
        localDemoLogin: auth.localDemoLogin,
        logout: auth.logout,

        // DB upserting decorators
        upsertVehicle: vehicle.upsertVehicle,
        upsertFinancialGoal: goals.upsertFinancialGoal,
        upsertVehicleCostSettings: vehicle.upsertVehicleCostSettings,
        
        addEarning: finance.addEarning,
        addExpense: finance.addExpense,
        deleteEarning: finance.deleteEarning,
        deleteExpense: finance.deleteExpense,
        createDailyClosing: finance.createDailyClosing,
        createWeeklyClosing: finance.createWeeklyClosing,
        
        addPeakRule: insights.addPeakRule,
        togglePeakRule: insights.togglePeakRule,
        addPassengerReport: insights.addPassengerReport,
        
        markAlertAsRead,
        archiveAlert,
        completeOnboarding,
        
        startSession: journey.startSession,
        endSession: journey.endSession,
        addRoutePoint: journey.addRoutePoint,
        addSmartAlert: alerts.addSmartAlert,

        updateUserPlan,
        updateSubscriptionStatus: subscriptions.updateSubscriptionStatus,
        toggleUserRole,
        toggleBlockUser,
        toggleBetaTester,
        requestUpgrade: subscriptions.requestUpgrade,
        approvePayment: subscriptions.approvePayment,
        rejectPayment: subscriptions.rejectPayment,

        metrics: finance.metrics
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthProvider>
      <FinanceProvider>
        <VehicleProvider>
          <GoalsProvider>
            <InsightsProvider>
              <SubscriptionsProvider>
                <JourneyProvider>
                  <DemandProvider>
                    <AlertsProvider>
                      <LegacyAppBridgeProvider>
                        {children}
                      </LegacyAppBridgeProvider>
                    </AlertsProvider>
                  </DemandProvider>
                </JourneyProvider>
              </SubscriptionsProvider>
            </InsightsProvider>
          </GoalsProvider>
        </VehicleProvider>
      </FinanceProvider>
    </AuthProvider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
export type { AppContextType };
