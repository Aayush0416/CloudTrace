import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useStartPath } from "./lib/prefs";
import { Loading } from "./components/ui";
import Layout from "./components/Layout";
import Landing from "./features/landing/Landing";
import AuthPage from "./features/auth/AuthPage";
import VerifyEmail from "./features/auth/VerifyEmail";
import { ForgotPassword, ResetPassword } from "./features/auth/PasswordPages";
import Home from "./features/home/Home";
import Account from "./features/account/Account";
import Projects from "./features/projects/Projects";
import Overview from "./features/dashboard/Overview";
import Explorer from "./features/attack-paths/Explorer";
import Reports from "./features/reports/Reports";
import Assistant from "./features/assistant/Assistant";
import Remediation from "./features/remediation/Remediation";
import { FindingsPage, ResourcesPage } from "./features/tables/Tables";
import AuditLogs from "./features/settings/AuditLogs";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking session" />;
  return user ? (
    <Layout>
      <Outlet />
    </Layout>
  ) : (
    <Navigate to="/login" replace />
  );
}
function Root() {
  const { user, loading } = useAuth();
  const start = useStartPath();
  return loading ? (
    <Loading label="Loading" />
  ) : user ? (
    <Navigate to={start} replace />
  ) : (
    <Landing />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Protected />}>
        <Route path="/home" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/p/:projectId/overview" element={<Overview />} />
        <Route path="/p/:projectId/attack-paths" element={<Explorer />} />
        <Route path="/p/:projectId/findings" element={<FindingsPage />} />
        <Route path="/p/:projectId/resources" element={<ResourcesPage />} />
        <Route path="/p/:projectId/reports" element={<Reports />} />
        <Route path="/p/:projectId/remediation" element={<Remediation />} />
        <Route path="/p/:projectId/assistant" element={<Assistant />} />
        <Route path="/p/:projectId/audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
