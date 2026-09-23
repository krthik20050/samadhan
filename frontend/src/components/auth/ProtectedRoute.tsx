import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '../common/Button';

export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isAdmin, user, logout, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-[#0F5C4D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[#5E6964]">Verifying operational credentials...</p>
        </div>
      </div>
    );
  }

  // Not signed in at all -> redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Signed in as passenger but trying to access admin -> prevent data breach / privilege escalation
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center p-4 sm:p-6 text-left">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#DDE4DF] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-[#B64242]/10 border border-[#B64242]/20 flex items-center justify-center text-[#B64242]">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B64242] bg-[#B64242]/10 px-2.5 py-1 rounded">
              Depot Access Restricted
            </span>
            <h2 className="text-2xl font-extrabold text-[#10201C]">
              Depot Staff Privilege Required
            </h2>
            <p className="text-sm text-[#5E6964] leading-relaxed">
              You are signed in as <strong className="text-[#10201C]">{user?.name}</strong> (Passenger Account). Depot operational registries and escalation desks require an authorized Depot Officer account.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <Link to="/login" onClick={logout} className="block">
              <Button variant="primary" size="md" fullWidth icon={<LogOut className="w-4 h-4" />}>
                Sign In with Depot Credentials
              </Button>
            </Link>

            <Link to="/" className="block">
              <Button variant="secondary" size="md" fullWidth icon={<ArrowLeft className="w-4 h-4" />}>
                Return to Passenger Portal
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
};
