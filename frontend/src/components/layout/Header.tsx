import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, Mic, Languages, User, ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '../common/Button';

export const Header: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: '/', label: t('navHome') },
    { to: '/track', label: t('navTrack') },
    { to: '/public', label: t('navPublic') },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F5F3EE] border-b border-[#D9D7D0]">
      <div className="app-container">
        <div className="flex items-center justify-between h-[72px]">
          {/* LEFT: Typographic & Confident Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus:outline-none"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="w-8 h-8 rounded-[8px] bg-[#164E48] flex items-center justify-center text-white shrink-0 font-bold text-[14px] transition-colors group-hover:bg-[#0B302D]">
              S
            </div>
            <div className="flex items-baseline gap-2 text-left">
              <span className="text-[19px] font-extrabold tracking-tight text-[#0B302D] font-['Plus_Jakarta_Sans']">
                SAMADHAN
              </span>
              <span className="text-[13px] font-semibold text-[#164E48] font-['Noto_Sans_Malayalam']">
                സമാധാൻ
              </span>
            </div>
          </Link>

          {/* CENTER: Editorial Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-[15px] transition-colors duration-150 py-1 relative ${
                    active
                      ? 'text-[#0B302D] font-semibold'
                      : 'text-[#6B706C] font-medium hover:text-[#171A19]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-[-4px] left-0 right-0 h-[2px] bg-[#164E48] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Language Toggle + Auth + CTA */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Minimal Language Toggle */}
            <div className="flex items-center bg-[#ECEAE4] border border-[#D9D7D0] rounded-[8px] p-0.5 text-[12px] font-medium">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded-[6px] transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-[#164E48] font-semibold'
                    : 'text-[#6B706C] hover:text-[#171A19]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ml')}
                className={`px-2 py-0.5 rounded-[6px] transition-colors cursor-pointer font-['Noto_Sans_Malayalam'] ${
                  language === 'ml'
                    ? 'bg-white text-[#164E48] font-semibold'
                    : 'text-[#6B706C] hover:text-[#171A19]'
                }`}
              >
                മല
              </button>
            </div>

            {/* Auth Link */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <Link
                    to="/admin/depot"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#164E48]/10 text-[#164E48] text-[13px] font-semibold hover:bg-[#164E48]/15 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Depot Ops</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white text-[#171A19] text-[13px] font-medium border border-[#D9D7D0]">
                    <User className="w-3.5 h-3.5 text-[#164E48]" />
                    <span className="max-w-[100px] truncate">{user?.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="p-1.5 rounded-[8px] text-[#6B706C] hover:text-[#B34747] transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-2.5 py-1.5 text-[14px] font-medium text-[#6B706C] hover:text-[#171A19] transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Primary Action Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/file-complaint')}
              className="text-[14px] h-[40px] px-4 font-semibold"
            >
              {language === 'ml' ? 'പരാതി നൽകുക' : 'File a Complaint'}
            </Button>
          </div>

          {/* Mobile Right Controls */}
          <div className="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ml' : 'en')}
              className="px-2 py-1 text-[12px] font-semibold rounded-[6px] border border-[#D9D7D0] bg-[#ECEAE4] text-[#164E48]"
            >
              <Languages className="w-3.5 h-3.5 inline mr-1" />
              {language === 'en' ? 'മല' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-[8px] text-[#171A19] hover:bg-[#ECEAE4] transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#D9D7D0] bg-[#F5F3EE] px-5 py-4 space-y-3">
          <nav className="space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3.5 py-2.5 rounded-[8px] text-[15px] font-medium ${
                  isActive(item.to)
                    ? 'bg-[#ECEAE4] text-[#0B302D] font-semibold'
                    : 'text-[#171A19] hover:bg-[#ECEAE4]'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {isAuthenticated ? (
              <div className="pt-2 border-t border-[#D9D7D0] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#171A19] flex items-center gap-2">
                  <User className="w-4 h-4 text-[#164E48]" />
                  <span>{user?.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-xs font-semibold text-[#B34747]"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3.5 py-2 rounded-[8px] text-[15px] font-semibold text-[#164E48] bg-white border border-[#D9D7D0]"
              >
                Sign In
              </Link>
            )}
          </nav>
          <div className="pt-2 border-t border-[#D9D7D0]">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/file-complaint/voice');
              }}
              icon={<Mic className="w-4 h-4" />}
            >
              {language === 'ml' ? 'പരാതി നൽകുക' : 'File a Complaint'}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
