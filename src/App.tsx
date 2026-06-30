import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { PageTitleHandler } from './components/PageTitleHandler';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { VehiclePage } from './pages/VehiclePage';
import { ReportsPage } from './pages/ReportsPage';
import { AdminPage } from './pages/AdminPage';
import { GoalsPage } from './pages/GoalsPage';
import { InsightsPage } from './pages/InsightsPage';
import { PlansPage } from './pages/PlansPage';
import { AlertsPage } from './pages/AlertsPage';
import { JornadaPage } from './pages/JornadaPage';
import { DebugPage } from './pages/DebugPage';
import { JornadasHistoryPage } from './pages/JornadasHistoryPage';
import { JornadaDetailPage } from './pages/JornadaDetailPage';
import { DemandaPage } from './pages/DemandaPage';
import { StatusPage } from './pages/StatusPage';
import { UberPassPage } from './pages/UberPassPage';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <PageTitleHandler />
        <Routes>
          {/* Guest routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/status" element={<StatusPage />} />

          {/* Core protected driver routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/debug"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DebugPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jornadas"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <JornadasHistoryPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jornadas/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <JornadaDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/jornada"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <JornadaPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/demanda"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DemandaPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alertas"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <AlertsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financeiro"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <FinancePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/veiculo"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <VehiclePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/uber-pass"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <UberPassPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/metas"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <GoalsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <InsightsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/planos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PlansPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin only route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AppLayout>
                  <AdminPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Root fallback redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
