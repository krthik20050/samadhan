import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import { COMPLAINT_CATEGORIES } from '../lib/constants';
import type { ComplaintCategory } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { lookupService } from '../lib/api';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { CategoryCard } from '../components/complaint/CategoryCard';
import { VoiceRecorder } from '../components/voice/VoiceRecorder';
import {
  Mic,
  FileEdit,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Upload,
  X,
  CheckCircle2,
  HelpCircle,
  Droplets,
  UserCheck,
  ShieldAlert,
  Wrench,
  Clock,
  Navigation,
  Users,
  HeartHandshake,
  CreditCard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles: Droplets,
  Droplets,
  UserCheck,
  ShieldAlert,
  Wrench,
  Clock,
  Navigation,
  Users,
  HeartHandshake,
  CreditCard,
  HelpCircle,
};

const STATIC_KERALA_STOPS = [
  'Alappuzha',
  'Aluva',
  'Angamaly',
  'Attingal',
  'Chalakudy',
  'Changanassery',
  'Ernakulam',
  'Guruvayur',
  'Kannur',
  'Kasaragod',
  'Kayamkulam',
  'Kollam',
  'Kottakkal',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Manjeri',
  'Muvattupuzha',
  'Palakkad',
  'Payyanur',
  'Perinthalmanna',
  'Ponnani',
  'Sultan Bathery',
  'Thalassery',
  'Thiruvananthapuram',
  'Thodupuzha',
  'Thrissur',
  'Tirur',
  'Vatakara',
];

const detectCategoryFromText = (text: string): ComplaintCategory | null => {
  const lower = text.toLowerCase();
  if (/clean|dirty|trash|vomit|waste|smell|stink|toilet|spill/.test(lower)) return 'cleanliness';
  if (/speed|rash|overtak|drunk|alcohol|danger|brake|drift|accident|racing|safety/.test(lower)) return 'safety';
  if (/late|delay|cancel|punctual|wait|timing|schedule|missed/.test(lower)) return 'delay_schedule';
  if (/conductor|driver|staff|rude|harass|insult|behavior|behaviour|shout|abuse|behave/.test(lower)) return 'staff_behaviour';
  if (/ticket|fare|change|extra money|overcharg|upi|balance|receipt/.test(lower)) return 'ticketing';
  if (/wheelchair|disabled|elderly|blind|handicap|accessible|ramp/.test(lower)) return 'accessibility';
  if (/seat|window|glass|door|engine|leak|vibration|ac|air condition|fan|light/.test(lower)) return 'bus_condition';
  if (/route|divert|bypass|skip|stop|skipped|service/.test(lower)) return 'route_service';
  return null;
};

export const FileComplaint: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { draft, updateDraft } = useComplaintDraft();

  const stepParam = searchParams.get('step');
  const [step, setStep] = useState<1 | 2>(stepParam === '2' ? 2 : 1);

  const modeParam = searchParams.get('mode');
  const catParam = searchParams.get('cat') as ComplaintCategory;
  const initialCategory =
    catParam && COMPLAINT_CATEGORIES.some((c) => c.id === catParam)
      ? catParam
      : draft.category || 'cleanliness';

  const [inputMode, setInputMode] = useState<'type' | 'voice'>(
    modeParam === 'voice' ? 'voice' : 'type'
  );
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory>(initialCategory);
  const [hasManuallySelectedCat, setHasManuallySelectedCat] = useState(Boolean(catParam));
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Form Fields
  const [description, setDescription] = useState(draft.description || '');
  const [origin, setOrigin] = useState(draft.origin || '');
  const [destination, setDestination] = useState(draft.destination || '');
  const [via, setVia] = useState(draft.via || '');
  const [busNumber, setBusNumber] = useState(draft.busNumber || '');
  const [location, setLocation] = useState(draft.location || '');
  const [evidenceFiles, setEvidenceFiles] = useState<string[]>(draft.evidenceFiles || []);
  const [showMoreDetails, setShowMoreDetails] = useState<boolean>(
    Boolean(draft.via || draft.busNumber || (draft.location && draft.location !== 'Onboard bus') || (draft.evidenceFiles && draft.evidenceFiles.length > 0))
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Dataset-backed stop suggestions (505 official KSRTC stations from the
  // scrape, via GET /api/v1/routes). Falls back to the static list offline.
  const [keralaStops, setKeralaStops] = useState<string[]>(STATIC_KERALA_STOPS);
  useEffect(() => {
    let cancelled = false;
    lookupService
      .searchRoutes('', 200)
      .then((routes) => {
        if (cancelled || routes.length === 0) return;
        const stops = new Set<string>();
        for (const r of routes) {
          stops.add(r.origin);
          stops.add(r.destination);
        }
        const merged = [...stops].sort((a, b) => a.localeCompare(b));
        if (merged.length >= STATIC_KERALA_STOPS.length) setKeralaStops(merged);
      })
      .catch(() => {
        /* offline: keep static list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategoryMeta =
    COMPLAINT_CATEGORIES.find((c) => c.id === selectedCategory) || COMPLAINT_CATEGORIES[0];
  const CategoryIcon = ICON_MAP[activeCategoryMeta.iconName] || HelpCircle;

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDescription(text);
    if (!hasManuallySelectedCat) {
      const detected = detectCategoryFromText(text);
      if (detected) {
        setSelectedCategory(detected);
      }
    }
  };

  const handleProceedToStep2 = () => {
    setValidationError(null);
    if (!description.trim()) {
      setValidationError('Please describe what happened before continuing.');
      return;
    }

    updateDraft({
      description: description.trim(),
      category: selectedCategory,
    });

    setStep(2);
    setSearchParams({ step: '2' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStep1 = () => {
    setValidationError(null);
    setStep(1);
    setSearchParams({ step: '1' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!origin.trim() || !destination.trim()) {
      setValidationError('Please provide both the starting and destination stops.');
      return;
    }

    updateDraft({
      category: selectedCategory,
      origin: origin.trim(),
      destination: destination.trim(),
      via: via.trim(),
      busNumber: busNumber.trim(),
      location: location.trim() || 'Onboard bus',
      description: description.trim(),
      evidenceFiles,
    });

    navigate('/file-complaint/review');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEvidenceFiles((prev) => [...prev, file.name]);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="app-container py-12 sm:py-16 text-left max-w-3xl">
      {/* HTML Datalist for Clean Route Autocomplete */}
      <datalist id="kerala-stops">
        {keralaStops.map((stop) => (
          <option key={stop} value={stop} />
        ))}
      </datalist>

      {/* Validation Message */}
      {validationError && (
        <div className="mb-6 p-3.5 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)] text-[14px]">
          {validationError}
        </div>
      )}

      {/* =================================================================
          STEP 01 / 03: TELL US WHAT HAPPENED
          ================================================================= */}
      {step === 1 && (
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="text-[12px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
              STEP 01 / 03
            </div>
            <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
              Tell us what happened.
            </h1>
            <p className="text-[16px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Describe the issue in your own words. You can type or speak.
            </p>
          </div>

          {/* Input Method Toggle: Type or Speak (Quiet row, no 'Speak Fastest') */}
          <div className="flex items-center gap-6 border-b border-[var(--border-standard)] text-[14px]">
            <button
              type="button"
              onClick={() => setInputMode('type')}
              className={`pb-3 font-medium transition-colors cursor-pointer relative flex items-center gap-2 ${
                inputMode === 'type'
                  ? 'text-[var(--brand)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileEdit className="w-4 h-4" />
              <span>Type</span>
              {inputMode === 'type' && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--brand)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setInputMode('voice')}
              className={`pb-3 font-medium transition-colors cursor-pointer relative flex items-center gap-2 ${
                inputMode === 'voice'
                  ? 'text-[var(--brand)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Speak</span>
              {inputMode === 'voice' && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--brand)]" />
              )}
            </button>
          </div>

          {/* Mode A: Typed Input */}
          {inputMode === 'type' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[12px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  DESCRIBE THE PROBLEM
                </label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={handleDescriptionChange}
                  className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[10px] p-4 text-[15px] focus:outline-none focus:border-[var(--brand)] placeholder:text-[var(--text-muted)] leading-relaxed"
                  placeholder="e.g. Bus arrived 45 minutes late with no announcement, or driver was overtaking dangerously on the highway..."
                  autoFocus
                />
              </div>

              {/* Category Selection UX: Suggested category card + Change toggle */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--text-secondary)]">
                    {hasManuallySelectedCat
                      ? 'Selected category:'
                      : 'Suggested from your description:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((prev) => !prev)}
                    className="text-[var(--brand)] font-medium hover:underline cursor-pointer"
                  >
                    {showAllCategories ? 'Keep this category' : 'Change category'}
                  </button>
                </div>

                {/* Collapsed State: Single Clean Highlight Card */}
                {!showAllCategories ? (
                  <div className="p-3.5 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--brand)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-[8px] bg-[var(--brand)] text-white flex items-center justify-center shrink-0">
                        <CategoryIcon className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-[var(--text-primary)] leading-snug">
                          {language === 'ml' ? activeCategoryMeta.labelMl : activeCategoryMeta.labelEn}
                        </h4>
                        <div className="text-[12px] text-[var(--text-secondary)]">
                          {language === 'ml' ? activeCategoryMeta.labelEn : activeCategoryMeta.labelMl}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(true)}
                      className="text-[12px] font-medium text-[var(--brand)] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* Expanded Grid of Categories */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <CategoryCard
                        key={cat.id}
                        category={cat}
                        compact={true}
                        isSelected={selectedCategory === cat.id}
                        onSelect={() => {
                          setSelectedCategory(cat.id);
                          setHasManuallySelectedCat(true);
                          setShowAllCategories(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Primary & Secondary Actions */}
              <div className="pt-6 border-t border-[var(--border-standard)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setInputMode('voice')}
                  className="text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-[var(--brand)]" />
                  <span>Speak instead</span>
                </button>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleProceedToStep2}
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  className="font-semibold px-8"
                >
                  Continue to Journey →
                </Button>
              </div>
            </div>
          )}

          {/* Mode B: Spoken Voice Intake */}
          {inputMode === 'voice' && (
            <div className="space-y-6">
              <VoiceRecorder
                onTranscriptionComplete={(result) => {
                  setDescription(result.transcript);
                  if (result.extracted.category) {
                    setSelectedCategory(result.extracted.category);
                  }
                  if (result.extracted.origin) setOrigin(result.extracted.origin);
                  if (result.extracted.destination) setDestination(result.extracted.destination);
                  if (result.extracted.via) setVia(result.extracted.via);
                  if (result.extracted.busNumber) setBusNumber(result.extracted.busNumber);

                  updateDraft({
                    ...result.extracted,
                    description: result.transcript,
                    audioTranscript: result.transcript,
                  });
                }}
              />

              {description && (
                <div className="p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)] space-y-3">
                  <div className="text-[12px] font-mono uppercase tracking-wider text-[var(--brand)] font-bold">
                    Here’s what we understood
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase">Description:</span>
                    <p className="text-[14px] text-[var(--text-primary)] mt-0.5 leading-relaxed">
                      {description}
                    </p>
                  </div>
                  <div className="pt-1 flex items-center justify-between text-[13px]">
                    <span className="text-[var(--text-secondary)]">
                      Suggested category: <strong className="text-[var(--text-primary)]">{activeCategoryMeta.labelEn}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setInputMode('type')}
                      className="text-[var(--brand)] hover:underline"
                    >
                      Edit details
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-[var(--border-standard)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setInputMode('type')}
                  className="text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileEdit className="w-4 h-4 text-[var(--brand)]" />
                  <span>Type instead</span>
                </button>

                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleProceedToStep2}
                  disabled={!description.trim()}
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  className="font-semibold px-8"
                >
                  Continue to Journey →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================
          STEP 02 / 03: WHERE DID IT HAPPEN?
          ================================================================= */}
      {step === 2 && (
        <form onSubmit={handleProceedToReview} className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="text-[12px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">
              STEP 02 / 03
            </div>
            <h1 className="text-[34px] sm:text-[42px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
              Where did it happen?
            </h1>
            <p className="text-[16px] text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Enter your starting and destination stops. Operating depot is assigned automatically based on route schedules.
            </p>
          </div>

          {/* Primary Route Inputs with Autocomplete */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="From (Starting Stop) *"
                placeholder="Search starting stop (e.g. Guruvayur)"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                list="kerala-stops"
                required
                autoFocus
              />
              <Input
                label="To (Destination Stop) *"
                placeholder="Search destination (e.g. Kozhikode)"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                list="kerala-stops"
                required
              />
            </div>

            {/* Subtle Route Confirmation */}
            {origin.trim() && destination.trim() && (
              <div className="p-3 rounded-[8px] bg-[var(--surface-primary)] border border-[var(--border-standard)] flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--brand)] shrink-0" />
                  <span className="font-bold text-[var(--text-primary)]">
                    {origin} → {destination}
                  </span>
                </div>
                <span className="text-[12px] text-[var(--text-secondary)]">
                  Operating depot will be determined automatically
                </span>
              </div>
            )}
          </div>

          {/* Progressive Disclosure Toggle */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowMoreDetails((prev) => !prev)}
              className="text-[13px] font-medium text-[var(--brand)] hover:underline inline-flex items-center gap-1 cursor-pointer py-1"
            >
              <span>{showMoreDetails ? 'Less details −' : 'More details +'}</span>
              {showMoreDetails ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showMoreDetails && (
              <div className="mt-3 space-y-4 p-5 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Bus Registration (Optional)"
                    placeholder="e.g. KL-15-A-4892"
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value)}
                  />
                  <Input
                    label="Via / Corridor (Optional)"
                    placeholder="e.g. Ponnani - Tirur"
                    value={via}
                    onChange={(e) => setVia(e.target.value)}
                  />
                </div>

                <Input
                  label="Location on Bus or Stop (Optional)"
                  placeholder="e.g. Middle row seats / Near platform 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />

                {/* Quiet Supporting Evidence Upload */}
                <div className="pt-2 space-y-2">
                  <span className="text-[12px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">
                    Supporting photo or document (Optional)
                  </span>

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      id="evidence-file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="evidence-file"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-[var(--brand)]" />
                      <span>Attach file</span>
                    </label>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      PNG, JPG, PDF up to 10MB
                    </span>
                  </div>

                  {evidenceFiles.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {evidenceFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-[6px] bg-[var(--bg-primary)] border border-[var(--border-standard)] text-[13px]"
                        >
                          <span className="font-mono text-[var(--text-primary)]">{file}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="text-[var(--text-secondary)] hover:text-[var(--semantic-error)] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="pt-6 border-t border-[var(--border-standard)] flex items-center justify-between">
            <button
              type="button"
              onClick={handleBackToStep1}
              className="text-[14px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Step 1</span>
            </button>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="font-semibold px-8"
            >
              Continue to Step 03: Review →
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
