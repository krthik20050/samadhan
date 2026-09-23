import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { Button } from '../components/common/Button';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Globe,
  Mic,
  MessageSquare,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-[var(--bg-primary)]">
      {/* ==================================================
          1. HERO SECTION (EDITORIAL ASYMMETRIC LAYOUT)
          ================================================== */}
      <section className="border-b border-[var(--border-standard)] bg-[var(--bg-primary)]">
        <div className="app-container py-16 sm:py-24 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start text-left">
            {/* LEFT COLUMN: Strong Editorial Headline & CTAs */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              {/* Product Context Tag */}
              <div className="inline-flex items-center gap-2 text-[12px] font-mono tracking-wider text-[var(--brand)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                <span>PUBLIC TRANSPORT GRIEVANCE SYSTEM</span>
              </div>

              {/* Primary Headline */}
              <h1 className="text-[44px] sm:text-[56px] lg:text-[64px] font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.06] whitespace-pre-line font-['Plus_Jakarta_Sans']">
                {language === 'ml'
                  ? 'പരാതിപ്പെടൂ.\nബാക്കി ഞങ്ങൾ ഏറ്റെടുക്കാം.'
                  : 'Report it.\nWe’ll take it from there.'}
              </h1>

              {/* Supporting Text */}
              <p className="text-[17px] sm:text-[19px] text-[var(--text-secondary)] leading-relaxed max-w-xl">
                {language === 'ml'
                  ? 'നിമിഷങ്ങൾക്കുള്ളിൽ നിങ്ങളുടെ യാത്രാ പരാതി സമർപ്പിക്കാം. സമാധാൻ അത് വ്യക്തമായ രേഖയാക്കി ബന്ധപ്പെട്ട ഡിപ്പോയിലേക്ക് കൈമാറുന്നു, തുടർനടപടികൾ കൃത്യമായി പരിശോധിക്കാം.'
                  : 'Report a public transport issue in seconds. SAMADHAN turns it into a structured complaint, routes it to the right depot and lets you track what happens next.'}
              </p>

              {/* Primary & Secondary Action Pair */}
              <div className="space-y-4 pt-1">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate('/file-complaint')}
                    className="font-semibold text-[15px] px-8"
                  >
                    {language === 'ml' ? 'പരാതി നൽകുക' : 'File a Complaint'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/track')}
                    icon={<Search className="w-4 h-4 text-[var(--text-secondary)]" />}
                    className="font-medium text-[15px]"
                  >
                    {language === 'ml' ? 'പരാതി പരിശോധിക്കുക' : 'Track a Complaint'}
                  </Button>
                </div>

                {/* Quiet Multi-Channel Secondary Links */}
                <div className="flex flex-wrap items-center gap-3 text-[13px] pt-1">
                  <span className="text-[var(--text-secondary)] font-medium">
                    {language === 'ml' ? 'പരാതിപ്പെടാനുള്ള വഴികൾ:' : 'Report another way →'}
                  </span>
                  <Link
                    to="/file-complaint"
                    className="font-medium text-[var(--brand)] hover:underline"
                  >
                    Web
                  </Link>
                  <span className="text-[var(--border-standard)]">·</span>
                  <Link
                    to="/file-complaint?mode=voice"
                    className="font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Voice</span>
                  </Link>
                  <span className="text-[var(--border-standard)]">·</span>
                  <a
                    href="#ways-to-report"
                    className="font-medium text-[var(--brand)] hover:underline"
                  >
                    WhatsApp
                  </a>
                  <span className="text-[var(--text-muted)] text-[12px] hidden sm:inline">— Different channels. One complaint workflow.</span>
                </div>
              </div>

              {/* 3 Core Guarantees: Minimal Row with Thin Divider */}
              <div className="pt-8 border-t border-[var(--border-standard)] flex flex-wrap items-center gap-6 text-[13px] text-[var(--text-secondary)]">
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Under 60s</span> intake
                </div>
                <span className="text-[var(--border-standard)]">•</span>
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Route-matched</span> depot routing
                </div>
                <span className="text-[var(--border-standard)]">•</span>
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">Time-bound</span> resolution SLA
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Restrained Editorial Process Diagram (NO Giant Box) */}
            <div className="lg:col-span-5 lg:pl-6 space-y-6 text-left">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)]" />
                  <span>OPERATIONAL WORKFLOW</span>
                </span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">ILLUSTRATIVE WORKFLOW</span>
              </div>

              <div className="space-y-4 font-mono text-[13px]">
                <div className="flex items-baseline justify-between border-b border-[var(--border-standard)] pb-3">
                  <span className="font-bold text-[var(--brand)]">01 / REPORT</span>
                  <span className="text-[var(--text-secondary)] font-sans">Web, Voice, or WhatsApp</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-[var(--border-standard)] pb-3">
                  <span className="font-bold text-[var(--brand)]">02 / ROUTE</span>
                  <span className="text-[var(--text-secondary)] font-sans">Official operating depot assignment</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-[var(--border-standard)] pb-3">
                  <span className="font-bold text-[var(--brand)]">03 / TRACK</span>
                  <span className="text-[var(--text-secondary)] font-sans">Real-time status reference</span>
                </div>
                <div className="flex items-baseline justify-between pb-1">
                  <span className="font-bold text-[var(--brand)]">04 / RESOLVE</span>
                  <span className="text-[var(--text-secondary)] font-sans">Time-bound citizen charter closure</span>
                </div>
              </div>

              <div className="pt-2 text-[12px] text-[var(--text-muted)] font-mono flex items-center justify-between border-t border-[var(--border-subtle)]">
                <span>Different channels. One workflow.</span>
                <Link to="/track" className="text-[var(--brand)] hover:underline inline-flex items-center gap-1">
                  <span>Track status</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          2. SIMPLE PROCESS: EDITORIAL HORIZONTAL FLOW
          ================================================== */}
      <section className="bg-[var(--surface-primary)] border-b border-[var(--border-standard)] py-20 sm:py-24">
        <div className="app-container">
          <div className="max-w-2xl text-left mb-16">
            <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--brand)]">
              HOW IT WORKS
            </span>
            <h2 className="text-[32px] sm:text-[40px] font-extrabold text-[var(--text-primary)] tracking-tight mt-1.5 font-['Plus_Jakarta_Sans']">
              Report. Route. Track. Resolve.
            </h2>
            <p className="text-[16px] text-[var(--text-secondary)] mt-2 leading-relaxed">
              Every passenger grievance moves through a transparent, time-bound resolution cycle.
            </p>
          </div>

          {/* 4-Step Editorial Process (Thin Separators, Large Numbers, NO Giant Boxes) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--border-standard)] text-left">
            {/* Step 01 */}
            <div className="md:px-8 first:pl-0 last:pr-0 pt-8 md:pt-0 space-y-3">
              <span className="text-[36px] sm:text-[44px] font-extrabold text-[var(--brand)] font-['Plus_Jakarta_Sans'] block leading-none">
                01
              </span>
              <span className="text-[12px] font-mono font-bold tracking-wider text-[var(--text-muted)] block uppercase">
                REPORT
              </span>
              <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                Tell us what happened
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Describe the route, stop, or vehicle issue via web, voice, or WhatsApp in under 60 seconds.
              </p>
            </div>

            {/* Step 02 */}
            <div className="md:px-8 first:pl-0 last:pr-0 pt-8 md:pt-0 space-y-3">
              <span className="text-[36px] sm:text-[44px] font-extrabold text-[var(--brand)] font-['Plus_Jakarta_Sans'] block leading-none">
                02
              </span>
              <span className="text-[12px] font-mono font-bold tracking-wider text-[var(--text-muted)] block uppercase">
                ROUTE
              </span>
              <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                Direct depot assignment
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                SAMADHAN matches the route schedule and assigns responsibility to the operating depot immediately.
              </p>
            </div>

            {/* Step 03 */}
            <div className="md:px-8 first:pl-0 last:pr-0 pt-8 md:pt-0 space-y-3">
              <span className="text-[36px] sm:text-[44px] font-extrabold text-[var(--brand)] font-['Plus_Jakarta_Sans'] block leading-none">
                03
              </span>
              <span className="text-[12px] font-mono font-bold tracking-wider text-[var(--text-muted)] block uppercase">
                TRACK
              </span>
              <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                Follow complaint status
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Follow real-time progress from submission to investigation with your reference code.
              </p>
            </div>

            {/* Step 04 */}
            <div className="md:px-8 first:pl-0 last:pr-0 pt-8 md:pt-0 space-y-3">
              <span className="text-[36px] sm:text-[44px] font-extrabold text-[var(--brand)] font-['Plus_Jakarta_Sans'] block leading-none">
                04
              </span>
              <span className="text-[12px] font-mono font-bold tracking-wider text-[var(--text-muted)] block uppercase">
                RESOLVE
              </span>
              <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                See what happens next
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Receive time-bound updates as depot officers complete corrective action on the vehicle or crew.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          3. MULTI-CHANNEL REPORTING (NO GIANT CARDS)
          ================================================== */}
      <section id="ways-to-report" className="py-20 sm:py-24 bg-[var(--bg-primary)] border-b border-[var(--border-standard)]">
        <div className="app-container">
          {/* Section Header */}
          <div className="max-w-2xl text-left mb-16">
            <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--brand)]">
              CHANNELS
            </span>
            <h2 className="text-[32px] sm:text-[40px] font-extrabold text-[var(--text-primary)] tracking-tight mt-1.5 font-['Plus_Jakarta_Sans']">
              Report your way.
            </h2>
            <p className="text-[16px] text-[var(--text-secondary)] mt-2 leading-relaxed">
              Different channels. One complaint workflow. Choose the entry point most convenient for your journey.
            </p>
          </div>

          {/* 3 Clean Editorial Columns with Horizontal Separator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14 text-left">
            {/* Option 1: Web */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-center text-[var(--brand)]">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">WEB</span>
                  <h3 className="text-[18px] font-bold text-[var(--text-primary)]">Structured Form</h3>
                </div>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Quick structured complaint form. Select frequently travelled corridors, bus numbers, and attach photos or tickets.
              </p>
              <Link
                to="/file-complaint?mode=type"
                className="text-[13px] font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1.5"
              >
                <span>File online</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Option 2: Voice */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-center text-[var(--brand)]">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">VOICE</span>
                  <h3 className="text-[18px] font-bold text-[var(--text-primary)]">Speak Naturally</h3>
                </div>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Speak naturally in Malayalam or English. Designed for passengers on moving buses and elderly commuters who prefer not to type.
              </p>
              <Link
                to="/file-complaint?mode=voice"
                className="text-[13px] font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1.5"
              >
                <span>Speak complaint</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Option 3: WhatsApp */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-center text-[var(--brand)]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] block">WHATSAPP</span>
                  <h3 className="text-[18px] font-bold text-[var(--text-primary)]">Familiar Channel</h3>
                </div>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Report issues directly inside your everyday chat app. Sends reference codes and depot milestone alerts straight to WhatsApp.
              </p>
              <Link
                to="/file-complaint"
                className="text-[13px] font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1.5"
              >
                <span>Select channel in intake</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          4. PUBLIC ACCOUNTABILITY & ESCALATION GUARANTEE
          ================================================== */}
      <section className="bg-[var(--surface-primary)] py-20 sm:py-24">
        <div className="app-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start text-left">
            {/* Left Narrative */}
            <div className="lg:col-span-6 space-y-4">
              <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--brand)]">
                ACCOUNTABILITY GUARANTEE
              </span>
              <h2 className="text-[30px] sm:text-[36px] font-extrabold text-[var(--text-primary)] tracking-tight leading-snug font-['Plus_Jakarta_Sans']">
                Automated Depot Escalation Hierarchy
              </h2>
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                SAMADHAN ensures grievances do not sit unaddressed. If an operating depot does not resolve the ticket within the target window, it automatically escalates up the supervisory chain.
              </p>
              <div className="pt-2">
                <Link
                  to="/public"
                  className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--brand)] hover:underline"
                >
                  <span>Learn about public transparency reporting</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right Escalation Tier Rows (Clean rules, NO Card inside Card) */}
            <div className="lg:col-span-6 space-y-0 divide-y divide-[var(--border-standard)] border-t border-b border-[var(--border-standard)]">
              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[12px] text-[var(--brand)]">T1</span>
                  <div>
                    <h4 className="text-[14px] font-bold text-[var(--text-primary)]">
                      Operating Depot Officer
                    </h4>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Initial intake, verification & corrective action
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">0 – 12h</span>
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[12px] text-[var(--brand)]">T2</span>
                  <div>
                    <h4 className="text-[14px] font-bold text-[var(--text-primary)]">
                      District Transport Officer (DTO)
                    </h4>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Automated escalation on depot SLA breach
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">12 – 24h</span>
              </div>

              <div className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-[12px] text-[var(--brand)]">T3</span>
                  <div>
                    <h4 className="text-[14px] font-bold text-[var(--text-primary)]">
                      Zonal Executive Director
                    </h4>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Critical policy & fleet operations review
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">24h+</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          5. QUIET PUBLIC INSIGHTS CALLOUT (NO GIANT BOX)
          ================================================== */}
      <section className="bg-[var(--bg-primary)] border-t border-[var(--border-standard)] py-16">
        <div className="app-container">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 text-left">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-[var(--semantic-success)]">
                <ShieldCheck className="w-4 h-4" />
                <span>CONFIDENTIAL & DIGNIFIED</span>
              </div>
              <h3 className="text-[22px] sm:text-[26px] font-bold text-[var(--text-primary)] font-['Plus_Jakarta_Sans']">
                Public service, accountable by design.
              </h3>
              <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                Personal contact details are restricted to grievance tracking and never exposed publicly. Public oversight reports reflect verified depot resolution metrics.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/file-complaint')}
                className="w-full sm:w-auto font-medium"
              >
                File a Complaint
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => navigate('/public')}
                className="w-full sm:w-auto"
              >
                Public Insights
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
