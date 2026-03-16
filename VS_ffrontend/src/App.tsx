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
import { ClipboardCheck, Home, Shield, Users } from 'lucide-react';
import { Layout } from './components/refine-ui/layout/layout';
import CreateElection from './pages/createElection';
import ElectionDetailsAD from './pages/electionDetailsAD';
import UserList from './pages/userList';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import LandingPage from './pages/landing';
import PendingApprovals from './pages/admin/pendingApprovals';
import ConstituencyDetails from './pages/constituencyDetails';
import AdminPollingCenterDetails from './pages/admin/adminPollingCenterDetails';
import UserDashboard from './pages/user/userDashboard';

// ── Helper: map role → home path ───────────────────────────────────────────────
function homePathForRole(role?: string): string {
  switch (role) {
    case 'ADMIN':
      return '/homeAdmin';
    case 'USER':
      return '/homeUSER';
    default:
      return '/homeUSER';
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

/**
 * Guards a subtree so that only ADMIN users can enter.
 * Any other authenticated role is bounced to /homeUSER.
 * Must be rendered inside <Refine>.
 */
const AdminGuard = () => {
  const { data: identity, isLoading } = useGetIdentity<{ role?: string }>();

  if (isLoading) return null;

  if (identity?.role !== 'ADMIN') {
    return <Navigate to="/homeUSER" replace />;
  }

  return <Outlet />;
};

/**
 * Guards a subtree so that only USER role can enter.
 * Admins (or any other role) are bounced back to /homeAdmin.
 * Must be rendered inside <Refine>.
 */
const UserGuard = () => {
  const { data: identity, isLoading } = useGetIdentity<{ role?: string }>();

  if (isLoading) return null;

  if (identity?.role !== 'USER') {
    return <Navigate to="/homeAdmin" replace />;
  }

  return <Outlet />;
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
                // ── USER resources ────────────────────────────────────────────
                {
                  name: 'user-dashboard',
                  list: '/homeUSER',
                  meta: { label: 'Dashboard', icon: <Shield />, role: 'USER' },
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
                  {/* Admin-only guard — redirects USERs to /homeUSER */}
                  <Route element={<AdminGuard />}>
                    {/* Admin portal */}
                    <Route path="/homeAdmin">
                      <Route index element={<Dashboard />} />
                      <Route path="createElection" element={<CreateElection />} />
                      <Route path="showElection/:id" element={<ElectionDetailsAD />} />
                      <Route path="showElection/:id/constituency/:cId" element={<ConstituencyDetails />} />
                      <Route path="showElection/:id/constituency/:cId/polling-center/:centerId" element={<AdminPollingCenterDetails />} />
                      <Route path="pending" element={<PendingApprovals />} />
                    </Route>
                    <Route path="/userslist">
                      <Route index element={<UserList />} />
                    </Route>
                  </Route>

                  {/* USER portal — only accessible to USER role */}
                  <Route element={<UserGuard />}>
                    <Route path="/homeUSER">
                      <Route index element={<UserDashboard />} />
                    </Route>
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
              <DocumentTitleHandler handler={({ autoGeneratedTitle }) => autoGeneratedTitle.replace(/refine/gi, 'Welec')} />
            </Refine>
          </DevtoolsProvider>
        </ThemeProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

