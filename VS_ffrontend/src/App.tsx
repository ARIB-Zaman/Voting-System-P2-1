import { Authenticated, Refine, useGetIdentity } from '@refinedev/core';
import { DevtoolsProvider } from '@refinedev/devtools';
import { RefineKbar, RefineKbarProvider } from '@refinedev/kbar';

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from '@refinedev/react-router';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import './App.css';
import { Toaster } from './components/refine-ui/notification/toaster';
import { useNotificationProvider } from './components/refine-ui/notification/use-notification-provider';
import { ThemeProvider } from './components/refine-ui/theme/theme-provider';
import { dataProvider } from './providers/data';
import { authProvider } from './providers/auth-provider';
import Dashboard from './pages/dashboardav';
import { CalendarCheck2, ClipboardCheck, Home, MapPin, Shield, Users } from 'lucide-react';
import { Layout } from './components/refine-ui/layout/layout';
import CreateElection from './pages/createElection';
import ElectionDetailsAD from './pages/electionDetailsAD';
import UserList from './pages/userList';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import LandingPage from './pages/landing';
import RoDashboard from './pages/ro/roDashboard';
import RoConstituencyDetails from './pages/ro/roConstituencyDetails';
import PoDashboard from './pages/po/poDashboard';
import ProDashboard from './pages/pro/proDashboard';
import PendingApprovals from './pages/admin/pendingApprovals';
import ConstituencyDetails from './pages/constituencyDetails';

// ── Helper: map role → home path ───────────────────────────────────────────────
function homePathForRole(role?: string): string {
  switch (role) {
    case 'ADMIN':
      return '/homeAdmin';
    case 'RO':
      return '/homeRO';
    case 'PO':
      return '/homePO';
    case 'PRO':
      return '/homePRO';
    default:
      return '/homeAdmin';
  }
}

/**
 * Reads the user's role and redirects to their home portal.
 * Must be rendered inside <Refine>.
 */
const RoleRedirect = () => {
  const { data: identity, isLoading } = useGetIdentity<{ role?: string }>();

  if (isLoading) return null;

  return <Navigate to={homePathForRole(identity?.role)} replace />;
};

function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              dataProvider={dataProvider}
              authProvider={authProvider}
              notificationProvider={useNotificationProvider()}
              routerProvider={routerProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: 'SpM1da-wX09pA-PYhmqZ',
              }}
              resources={[
                // ── Admin resources ───────────────────────────────────────────
                {
                  name: 'election',
                  list: '/homeAdmin',
                  create: '/homeAdmin/createElection',
                  show: '/homeAdmin/showElection/:id',
                  meta: { label: 'Election', icon: <Home />, role: 'ADMIN' },
                },
                {
                  name: 'users',
                  list: '/userslist',
                  meta: { label: 'Users', icon: <Users />, role: 'ADMIN' },
                },
                {
                  name: 'pending-approvals',
                  list: '/homeAdmin/pending',
                  meta: { label: 'Pending Approvals', icon: <ClipboardCheck />, role: 'ADMIN' },
                },
                // ── RO resources ──────────────────────────────────────────────
                {
                  name: 'ro-elections',
                  list: '/homeRO',
                  meta: { label: 'Elections', icon: <CalendarCheck2 />, role: 'RO' },
                },
                // ── PO resources ──────────────────────────────────────────────
                {
                  name: 'po-station',
                  list: '/homePO',
                  meta: { label: 'My Station', icon: <MapPin />, role: 'PO' },
                },
                // ── PRO resources ─────────────────────────────────────────────
                {
                  name: 'pro-station',
                  list: '/homePRO',
                  meta: { label: 'My Station', icon: <Shield />, role: 'PRO' },
                },
              ]}
            >
              <Routes>
                {/* ── Public routes (no Layout/sidebar) ────────────────── */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* ── Protected routes (all share the same Layout/sidebar) ── */}
                <Route
                  element={
                    <Authenticated key="main-layout" fallback={<Navigate to="/" replace />}>
                      <Layout>
                        <Outlet />
                      </Layout>
                    </Authenticated>
                  }
                >
                  {/* Admin portal */}
                  <Route path="/homeAdmin">
                    <Route index element={<Dashboard />} />
                    <Route path="createElection" element={<CreateElection />} />
                    <Route path="showElection/:id" element={<ElectionDetailsAD />} />
                    <Route path="showElection/:id/constituency/:cId" element={<ConstituencyDetails />} />
                    <Route path="pending" element={<PendingApprovals />} />
                  </Route>
                  <Route path="/userslist">
                    <Route index element={<UserList />} />
                  </Route>

                  {/* RO portal */}
                  <Route path="/homeRO">
                    <Route index element={<RoDashboard />} />
                    <Route path="constituency/:cId" element={<RoConstituencyDetails />} />
                  </Route>

                  {/* PO portal */}
                  <Route path="/homePO">
                    <Route index element={<PoDashboard />} />
                  </Route>

                  {/* PRO portal */}
                  <Route path="/homePRO">
                    <Route index element={<ProDashboard />} />
                  </Route>

                  {/* Authenticated root: redirect based on role */}
                  <Route path="/dashboard" element={<RoleRedirect />} />
                </Route>

                {/* Catch-all: redirect to landing */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>

              <Toaster richColors position="top-center" />
              <RefineKbar />
              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

