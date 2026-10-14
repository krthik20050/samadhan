import { useText } from './hooks/useText';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ComplaintDraftProvider } from './context/ComplaintDraftContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Public Passenger pages — the core filing/tracking journey stays in the
// initial bundle; everything else is code-split (AUDIT.md M-1: the single
// 598 kB chunk forced every visitor to download the admin console).
import { Home } from './pages/Home';
import { FileComplaint } from './pages/FileComplaint';
import { ReviewComplaint } from './pages/ReviewComplaint';
import { ComplaintSuccess } from './pages/ComplaintSuccess';
import { TrackComplaint } from './pages/TrackComplaint';
import { MyAccount } from './pages/MyAccount';

// Code-split: voice recording, public dashboard, auth, admin console.
const PublicDashboard = lazy(() => import('./pages/PublicDashboard').then(m => ({ default: m.PublicDashboard })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminComplaints = lazy(() => import('./pages/admin/AdminComplaints').then(m => ({ default: m.AdminComplaints })));
const AdminEscalations = lazy(() => import('./pages/admin/AdminEscalations').then(m => ({ default: m.AdminEscalations })));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications').then(m => ({ default: m.AdminNotifications })));

function App() {
  const tx = useText();
  return (
    <AuthProvider>
        <ComplaintDraftProvider>
          <BrowserRouter>
            <Suspense
              fallback={
                <div className="min-h-screen grid place-items-center text-sm text-[var(--text-secondary)]">
                  {tx("Loading…")}</div>
              }
            >
            <Routes>
              {/* 1. PASSENGER EXPERIENCE (Completely Open, Zero Admin UI) */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/file-complaint" element={<FileComplaint />} />
                <Route path="/file-complaint/voice" element={<Navigate to="/file-complaint?mode=voice" replace />} />
                <Route path="/file-complaint/review" element={<ReviewComplaint />} />
                <Route path="/file-complaint/success" element={<ComplaintSuccess />} />
                <Route path="/track" element={<TrackComplaint />} />
                <Route path="/account" element={<MyAccount />} />
                <Route path="/public" element={<PublicDashboard />} />
              </Route>

              {/* 2. DEDICATED DEPOT / ADMIN LOGIN */}
              <Route path="/login" element={<Login />} />

              {/* 3. RESTRICTED DEPOT / ADMIN EXPERIENCE (Strictly Protected) */}
              <Route
                path="/admin/depot"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="complaints" element={<AdminComplaints />} />
                <Route path="escalations" element={<AdminEscalations />} />
                <Route path="notifications" element={<AdminNotifications />} />
              </Route>

              {/* Backward compatibility redirects for /admin to /admin/depot */}
              <Route path="/admin" element={<Navigate to="/admin/depot" replace />} />
              <Route path="/admin/complaints" element={<Navigate to="/admin/depot/complaints" replace />} />
              <Route path="/admin/escalations" element={<Navigate to="/admin/depot/escalations" replace />} />
              <Route path="/admin/notifications" element={<Navigate to="/admin/depot/notifications" replace />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </ComplaintDraftProvider>
    </AuthProvider>
  );
}

export default App;
