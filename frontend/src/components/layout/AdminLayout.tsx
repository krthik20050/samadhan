import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Bell,
  ArrowLeft,
  Building2,
  Menu,
  X,
  LogOut,
  User,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const navItems = [
    { to: '/admin/depot', label: 'Operations Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, exact: true },
    { to: '/admin/depot/complaints', label: 'Depot Grievances', icon: <FileText className="w-4 h-4" /> },
    { to: '/admin/depot/escalations', label: 'Escalations & SLA', icon: <AlertTriangle className="w-4 h-4 text-[var(--semantic-error)]" /> },
    { to: '/admin/depot/notifications', label: 'Notification Log', icon: <Bell className="w-4 h-4" /> },
  ];

  const isCurrent = (to: string, exact = false) => {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-[var(--surface-primary)] border-b border-[var(--border-standard)] p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--brand)] flex items-center justify-center text-[var(--accent)] font-bold text-sm">
            S
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-[var(--text-primary)]">SAMADHAN</h1>
            <p className="text-[11px] font-mono text-[var(--text-muted)]">DEPOT OPERATIONS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-[8px] border border-[var(--border-standard)] text-[var(--text-secondary)] hover:text-[var(--semantic-error)] transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 rounded-[8px] border border-[var(--border-standard)] text-[var(--text-primary)]"
            aria-label="Toggle navigation menu"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sidebar for Desktop / Drawer for Mobile */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[var(--surface-primary)] border-r border-[var(--border-standard)] flex flex-col transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header / Brand */}
        <div className="p-5 border-b border-[var(--border-standard)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[var(--brand)] flex items-center justify-center text-[var(--accent)]">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[16px] text-[var(--text-primary)] tracking-tight">SAMADHAN</span>
                <span className="text-[9px] font-mono font-bold text-[var(--brand)] bg-[var(--surface-secondary)] border border-[var(--border-standard)] px-1.5 py-0.2 rounded">
                  DEPOT
                </span>
              </div>
              <p className="text-[11px] font-mono text-[var(--text-muted)]">Operations Command</p>
            </div>
          </div>

          {/* Subtly show logged in officer name */}
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <div className="w-6 h-6 rounded-full bg-[var(--surface-secondary)] border border-[var(--border-standard)] flex items-center justify-center text-[var(--brand)]">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--text-primary)] truncate">{user?.name || 'Depot Officer'}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">Authorised Session</div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isCurrent(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <span className={active ? 'text-[var(--accent)]' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions: Logout and Switch back to Passenger View */}
        <div className="p-3 border-t border-[var(--border-standard)] space-y-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-[8px] border border-[var(--border-standard)] text-[12px] font-medium text-[var(--semantic-error)] hover:bg-[var(--surface-secondary)] active:scale-[0.98] transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>

          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-[8px] border border-[var(--border-standard)] text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] active:scale-[0.98] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Passenger View</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
