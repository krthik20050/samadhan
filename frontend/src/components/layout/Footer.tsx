import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../hooks/useLanguage';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[var(--surface-primary)] border-t border-[var(--border-standard)] mt-auto">
      <div className="app-container py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Purpose */}
          <div className="md:col-span-6 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[var(--brand)] flex items-center justify-center text-white shrink-0">
                <span className="font-bold text-[15px]">S</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] font-extrabold tracking-tight text-[var(--brand-deep)] font-['Plus_Jakarta_Sans']">
                  SAMADHAN
                </span>
                <span className="text-[13px] font-semibold text-[var(--brand)] font-['Noto_Sans_Malayalam']">
                  സമാധാൻ
                </span>
              </div>
            </div>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed max-w-md">
              Making public transport complaints simple to report, route, track and resolve. Different ways to report. One simple system to resolve it.
            </p>
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] pt-1">
              <ShieldCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <span>Personal details are protected and never displayed publicly.</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3 lg:col-span-3 space-y-3">
            <h4 className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Passenger Portal
            </h4>
            <ul className="space-y-2 text-[14px] text-[var(--text-secondary)]">
              <li>
                <Link to="/file-complaint" className="hover:text-[var(--brand)] transition-colors">
                  {t('navFileComplaint')}
                </Link>
              </li>
              <li>
                <Link to="/file-complaint/voice" className="hover:text-[var(--brand)] transition-colors">
                  Speak a Complaint
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-[var(--brand)] transition-colors">
                  {t('navTrack')}
                </Link>
              </li>
              <li>
                <Link to="/public" className="hover:text-[var(--brand)] transition-colors">
                  {t('navPublic')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Principles & Operating Authority Link */}
          <div className="md:col-span-3 lg:col-span-4 space-y-3">
            <h4 className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Citizen Charter
            </h4>
            <ul className="space-y-1.5 text-[13px] text-[var(--text-secondary)]">
              <li>• Multi-channel intake: Web, Voice, WhatsApp</li>
              <li>• Automated route to operating depot mapping</li>
              <li>• Time-bound Citizen Charter resolution window</li>
              <li>• Automatic supervisory escalation for overdue cases</li>
            </ul>
            <div className="pt-2">
              <Link
                to="/login"
                className="text-[12px] font-mono text-[var(--brand)] hover:underline transition-colors"
              >
                Depot Staff Login →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[var(--border-standard)] mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[var(--text-muted)] gap-3 font-mono">
          <p>© 2026 SAMADHAN (സമാധാൻ). Designed for Public Transport Passengers.</p>
          <div className="flex items-center gap-5">
            <span>Accessibility First</span>
            <span>Privacy Focused</span>
            <span>Data Integrity</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
