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
import { ClipboardCheck, Home, Shield, Users, Building2, Earth } from 'lucide-react';
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
import ClosedElectionResults from './pages/closedElectionResults';
import FinalizedElection from './pages/finalizedElection';
import FinalizedConstituencyDetail from './pages/finalizedConstituencyDetail';
import UserDashboard from './pages/user/userDashboard';
import AddVoter from './pages/admin/voters/AddVoter';
import BulkUploadVoters from './pages/admin/voters/BulkUploadVoters';
import ManageVoters from './pages/admin/voters/ManageVoters';
import AddPollingCenter from './pages/admin/pollingCenters/AddPollingCenter';
import ManagePollingCenters from './pages/admin/pollingCenters/ManagePollingCenters';
import BulkUploadPollingCenters from './pages/admin/pollingCenters/BulkUploadPollingCenters';
import AddConstituency from './pages/admin/constituencies/AddConstituency';
import BulkUploadConstituencies from './pages/admin/constituencies/BulkUploadConstituencies';
import ManageConstituencies from './pages/admin/constituencies/ManageConstituencies';
import ElectionEntry from './pages/user/election/ElectionEntry';
import KioskLayout from './pages/kiosk/KioskLayout';
import KioskElections from './pages/kiosk/KioskElections';
import KioskConstituencies from './pages/kiosk/KioskConstituencies';
import KioskPollingCenters from './pages/kiosk/KioskPollingCenters';
import KioskBooths from './pages/kiosk/KioskBooths';
import KioskVoting from './pages/kiosk/KioskVoting';
import VoterDashboard from './pages/user/election/VoterDashboard';
import VoterPortalLayout from './pages/user/portal/VoterPortalLayout';
import VoterPortalLogin from './pages/user/portal/VoterPortalLogin';
import VoterPortalDashboard from './pages/user/portal/VoterPortalDashboard';

// ── Helper: map role → home path ───────────────────────────────────────────────
function homePathForRole(role?: string): string {
  switch (role) {
    case 'ADMIN':
      return '/homeAdmin';
    case 'USER':
      return '/homeUSER';
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
                {
                  name: 'voters',
                  meta: { label: 'Voters', icon: <Users />, role: 'ADMIN' },
                },
                {
                  name: 'voter-add',
                  list: '/homeAdmin/voters/add',
                  meta: { label: 'Add Voter', parent: 'voters', role: 'ADMIN' },
                },
                {
                  name: 'voter-bulk',
                  list: '/homeAdmin/voters/bulk',
                  meta: { label: 'Bulk Upload', parent: 'voters', role: 'ADMIN' },
                },
                {
                  name: 'voter-manage',
                  list: '/homeAdmin/voters/manage',
                  meta: { label: 'Manage Voters', parent: 'voters', role: 'ADMIN' },
                },
                {
                  name: 'constituencies',
                  meta: { label: 'Constituencies', icon: <Earth />, role: 'ADMIN' },
                },
                {
                  name: 'cons-add',
                  list: '/homeAdmin/constituencies/add',
                  meta: { label: 'Add Constituency', parent: 'constituencies', role: 'ADMIN' },
                },
                {
                  name: 'cons-bulk',
                  list: '/homeAdmin/constituencies/bulk',
                  meta: { label: 'Bulk Upload', parent: 'constituencies', role: 'ADMIN' },
                },
                {
                  name: 'cons-manage',
                  list: '/homeAdmin/constituencies/manage',
                  meta: { label: 'Manage', parent: 'constituencies', role: 'ADMIN' },
                },
                {
                  name: 'polling-centers',
                  meta: { label: 'Polling Centers', icon: <Building2 />, role: 'ADMIN' },
                },
                {
                  name: 'pc-add',
                  list: '/homeAdmin/polling-centers/add',
                  meta: { label: 'Add Polling Center', parent: 'polling-centers', role: 'ADMIN' },
                },
                {
                  name: 'pc-bulk',
                  list: '/homeAdmin/polling-centers/bulk',
                  meta: { label: 'Bulk Upload', parent: 'polling-centers', role: 'ADMIN' },
                },
                {
                  name: 'pc-manage',
                  list: '/homeAdmin/polling-centers/manage',
                  meta: { label: 'Manage', parent: 'polling-centers', role: 'ADMIN' },
                },
                // ── USER resources ────────────────────────────────────────────
                {
                  name: 'voter-dashboard',
                  list: '/homeUSER/voter-dashboard',
                  meta: { label: 'Voter Dashboard', icon: <Earth />, role: 'USER', hideInOfficerMode: true },
                },
                {
                  name: 'user-dashboard',
                  list: '/homeUSER',
                  meta: { label: 'Officer Dashboard', icon: <Shield />, role: 'USER' },
                },
              ]}
            >
              <Routes>
                {/* ── Public routes (no Layout/sidebar) ────────────────── */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* ── Kiosk routes (no auth required) ─────────────────── */}
                <Route element={<KioskLayout />}>
                  <Route path="/kiosk" element={<KioskElections />} />
                  <Route path="/kiosk/election/:electionId" element={<KioskConstituencies />} />
                  <Route path="/kiosk/election/:electionId/constituency/:constituencyId" element={<KioskPollingCenters />} />
                  <Route path="/kiosk/election/:electionId/constituency/:constituencyId/center/:centerId" element={<KioskBooths />} />
                  <Route path="/kiosk/election/:electionId/constituency/:constituencyId/center/:centerId/booth/:boothId/vote" element={<KioskVoting />} />
                </Route>

                {/* ── Voter Portal routes (Public, NID-based) ─────────── */}
                <Route element={<VoterPortalLayout />}>
                  <Route path="/voter-portal" element={<VoterPortalLogin />} />
                  <Route path="/voter-portal/dashboard" element={<VoterPortalDashboard />} />
                </Route>

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
                      <Route path="closedElection/:id" element={<ClosedElectionResults />} />
                      <Route path="finalizedElection/:id" element={<FinalizedElection />} />
                      <Route path="finalizedElection/:id/constituency/:cId" element={<FinalizedConstituencyDetail />} />
                      <Route path="pending" element={<PendingApprovals />} />
                      <Route path="voters">
                        <Route path="add" element={<AddVoter />} />
                        <Route path="bulk" element={<BulkUploadVoters />} />
                        <Route path="manage" element={<ManageVoters />} />
                      </Route>
                      <Route path="constituencies">
                        <Route path="add" element={<AddConstituency />} />
                        <Route path="bulk" element={<BulkUploadConstituencies />} />
                        <Route path="manage" element={<ManageConstituencies />} />
                      </Route>
                      <Route path="polling-centers">
                        <Route path="add" element={<AddPollingCenter />} />
                        <Route path="bulk" element={<BulkUploadPollingCenters />} />
                        <Route path="manage" element={<ManagePollingCenters />} />
                      </Route>
                    </Route>
                    <Route path="/userslist">
                      <Route index element={<UserList />} />
                    </Route>
                  </Route>

                  {/* USER portal — only accessible to USER role */}
                  <Route element={<UserGuard />}>
                    <Route path="/homeUSER">
                      <Route index element={<UserDashboard />} />
                      <Route path="election/:id" element={<ElectionEntry />} />
                      <Route path="voter-dashboard" element={<VoterDashboard />} />
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

