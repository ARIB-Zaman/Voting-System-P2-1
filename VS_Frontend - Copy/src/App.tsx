import { Refine } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";

import routerProvider, {
  DocumentTitleHandler,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import "./App.css";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { dataProvider } from "./providers/data";
import Dashboard from "./pages/dashboard";
import { Home, Users } from "lucide-react";
import { Layout } from "./components/refine-ui/layout/layout";
import VoterList from "./pages/voterlist";
import CreateElection from "./pages/createElection";
import ElectionDetailsAD from "./pages/electionDetailsAD";


function App() {
  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ThemeProvider>
          <DevtoolsProvider>
            <Refine
              dataProvider={dataProvider}
              notificationProvider={useNotificationProvider()}
              routerProvider={routerProvider}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                projectId: "SpM1da-wX09pA-PYhmqZ",
              }}
              resources={[
                {
                  name : 'election',
                  list : '/homeAdmin',
                  create: '/homeAdmin/createElection',
                  show : '/homeAdmin/showElection/:id',
                  meta : { label: 'Election', icon : <Home/>}
                },
                {
                  name : 'users',
                  list : '/userslist',
                  meta : { label: 'Users', icon: <Users/>}
                }
              ]}
            >
              <Routes>
                <Route element = {<Layout Title={({ collapsed }) => <div>{collapsed ? "S" : "Something"}</div>}>
                  <Outlet/>
                  </Layout> }>
                
                  <Route path="/homeAdmin">
                    <Route index element={<Dashboard/>}/>
                    <Route path="/homeAdmin/createElection" element={<CreateElection/>}/>
                    <Route path="/homeAdmin/showElection/:id" element={<ElectionDetailsAD/>}/>
                  </Route>
                  <Route path="/userslist">
                    <Route index element={<VoterList/>}/>
                  </Route>
                </Route>
              </Routes>
              <Toaster richColors position="top-center"/>
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
