import { Routes, Route, Navigate } from 'react-router-dom';

import { LanguageProvider } from './context/LanguageContext';
import { ComplaintDraftProvider } from './context/ComplaintDraftContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Public Passenger pages
import { Home } from './pages/Home';
import { FileComplaint } from './pages/FileComplaint';
import { VoiceComplaint } from './pages/VoiceComplaint';
import { ReviewComplaint } from './pages/ReviewComplaint';
import { ComplaintSuccess } from './pages/ComplaintSuccess';
import { TrackComplaint } from './pages/TrackComplaint';
import { PublicDashboard } from './pages/PublicDashboard';

// Authentication page
import { Login } from './pages/Login';

// Admin / Depot Ops pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminComplaints } from './pages/admin/AdminComplaints';
import { AdminEscalations } from './pages/admin/AdminEscalations';
import { AdminNotifications } from './pages/admin/AdminNotifications';

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ComplaintDraftProvider>
          <Routes>
            {/* 1. PASSENGER EXPERIENCE */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/file-complaint" element={<FileComplaint />} />
              <Route path="/file-complaint/voice" element={<VoiceComplaint />} />
              <Route path="/file-complaint/review" element={<ReviewComplaint />} />
              <Route path="/file-complaint/success" element={<ComplaintSuccess />} />
              <Route path="/track" element={<TrackComplaint />} />
              <Route path="/public" element={<PublicDashboard />} />
            </Route>

            {/* 2. DEDICATED DEPOT / ADMIN LOGIN */}
            <Route path="/login" element={<Login />} />

            {/* 3. RESTRICTED DEPOT / ADMIN EXPERIENCE */}
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

            {/* Backward compatibility redirects */}
            <Route
              path="/admin"
              element={<Navigate to="/admin/depot" replace />}
            />
            <Route
              path="/admin/complaints"
              element={<Navigate to="/admin/depot/complaints" replace />}
            />
            <Route
              path="/admin/escalations"
              element={<Navigate to="/admin/depot/escalations" replace />}
            />
            <Route
              path="/admin/notifications"
              element={<Navigate to="/admin/depot/notifications" replace />}
            />

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ComplaintDraftProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;