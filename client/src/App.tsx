import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import MatchDetail from './pages/MatchDetail';
import Requests from './pages/Requests';
import Exchanges from './pages/Exchanges';
import ExchangeWorkspace from './pages/ExchangeWorkspace';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Skills from './pages/Skills';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Membership from './pages/Membership';
import ProfileAnalytics from './pages/ProfileAnalytics';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/matches" element={<Discover />} />
            <Route path="/matches/:userId" element={<MatchDetail />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/exchanges" element={<Exchanges />} />
            <Route path="/exchanges/:id" element={<ExchangeWorkspace />} />
            <Route path="/exchanges/:id/chat" element={<ExchangeWorkspace />} />
            <Route path="/exchanges/:id/sessions" element={<ExchangeWorkspace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/analytics" element={<ProfileAnalytics />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users" element={<Admin />} />
            <Route path="/admin/skills" element={<Admin />} />
            <Route path="/admin/reports" element={<Admin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
