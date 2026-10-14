import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import { newIdempotencyKey } from '../context/ComplaintDraftContext';
import { COMPLAINT_CATEGORIES } from '../lib/constants';
import { complaintsService } from '../lib/api';
import type { ComplaintCategory } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { lookupService } from '../lib/api';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { CategoryCard } from '../components/complaint/CategoryCard';
import { VoiceRecorder } from '../components/voice/VoiceRecorder';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mic,
  Paperclip,
  Ticket,
  Upload,
  X,
} from 'lucide-react';

const STATIC_KERALA_STOPS = [
  'Alappuzha', 'Aluva', 'Angamaly', 'Attingal', 'Chalakudy', 'Changanassery',
  'Ernakulam', 'Guruvayur', 'Kannur', 'Kasaragod', 'Kayamkulam', 'Kollam',
  'Kottakkal', 'Kottayam', 'Kozhikode', 'Malappuram', 'Manjeri',
  'Muvattupuzha', 'Palakkad', 'Payyanur', 'Perinthalmanna', 'Ponnani',
  'Sultan Bathery', 'Thalassery', 'Thiruvananthapuram', 'Thodupuzha',
  'Thrissur', 'Tirur', 'Vatakara',
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
  const { t, language } = useLanguage();
  const { draft, updateDraft, setLastSubmittedComplaint } = useComplaintDraft();
  const [description, setDescription] = useState(draft.description || '');
  const [origin, setOrigin] = useState(draft.origin || '');
  const [destination, setDestination] = useState(draft.destination || '');
  const [via, setVia] = useState(draft.via || '');
  const [busNumber, setBusNumber] = useState(draft.busNumber || '');
  const [location, setLocation] = useState(draft.location || '');
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory>(draft.category || 'cleanliness');
  const [hasSelectedCategory, setHasSelectedCategory] = useState(Boolean(draft.category));
  const [showCategories, setShowCategories] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [phone, setPhone] = useState(draft.contactPhone || '');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>(draft.preferredContactChannel || 'whatsapp');
  const [keralaStops, setKeralaStops] = useState(STATIC_KERALA_STOPS);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'reading' | 'read' | 'failed' | 'unavailable'>(
    draft.ticketExtracted ? 'read' : 'idle',
  );
  const [ticketFields, setTicketFields] = useState<string[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState(draft.evidenceFiles || []);
  const [uploadedEvidence, setUploadedEvidence] = useState(draft.uploadedEvidence || []);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => draft.idempotencyKey || newIdempotencyKey());

  useEffect(() => {
    let cancelled = false;
    lookupService.searchRoutes('', 200).then((routes) => {
      if (cancelled || routes.length === 0) return;
      const stops = new Set<string>();
      routes.forEach((route) => {
        stops.add(route.origin);
        stops.add(route.destination);
      });
      setKeralaStops([...stops].sort((a, b) => a.localeCompare(b)));
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const activeCategory = COMPLAINT_CATEGORIES.find((category) => category.id === selectedCategory) || COMPLAINT_CATEGORIES[0];

  const syncDraft = (extra: Partial<typeof draft> = {}) => {
    updateDraft({
      category: selectedCategory,
      description: description.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      via: via.trim(),
      busNumber: busNumber.trim(),
      location: location.trim() || 'Onboard bus',
      contactPhone: phone.trim(),
      preferredContactChannel: channel,
      evidenceFiles,
      uploadedEvidence,
      idempotencyKey,
      ...extra,
    });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (!hasSelectedCategory) {
      const detected = detectCategoryFromText(value);
      if (detected) setSelectedCategory(detected);
    }
  };

  const handleTicketUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setTicketStatus('reading');
    void (async () => {
      const extracted = await complaintsService.extractTicket(file);
      const found = extracted
        ? Object.entries(extracted).filter(([, value]) => value !== null && value !== '' && value !== false).map(([key]) => key)
        : [];
      if (extracted && found.length > 0) {
        setTicketStatus('read');
        setTicketFields(found);
        if (extracted.bus_number) setBusNumber(extracted.bus_number);
        if (extracted.origin) setOrigin(extracted.origin);
        if (extracted.destination) setDestination(extracted.destination);
        syncDraft({
          ticketExtracted: extracted as unknown as Record<string, unknown>,
          travelDate: extracted.travel_date,
          busNumber: extracted.bus_number || busNumber,
          origin: extracted.origin || origin,
          destination: extracted.destination || destination,
        });
      } else {
        setTicketStatus(extracted ? 'failed' : 'unavailable');
      }
      try {
        const uploaded = await complaintsService.uploadEvidence(file);
        setUploadedEvidence((current) => [...current, { ...uploaded, name: file.name }]);
        setEvidenceFiles((current) => [...current, file.name]);
      } catch {
        setError(t('formUploadError'));
      }
    })();
  };

  const handleEvidenceUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingEvidence(true);
    setError(null);
    complaintsService.uploadEvidence(file).then((uploaded) => {
      setUploadedEvidence((current) => [...current, { ...uploaded, name: file.name }]);
      setEvidenceFiles((current) => [...current, file.name]);
    }).catch(() => setError(t('formUploadError'))).finally(() => setUploadingEvidence(false));
  };

  const removeEvidence = (index: number) => {
    setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setUploadedEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleVoiceComplete = (result: { transcript: string; extracted: Partial<typeof draft> }) => {
    setDescription(result.extracted.description || result.transcript);
    if (result.extracted.category) setSelectedCategory(result.extracted.category);
    if (result.extracted.origin) setOrigin(result.extracted.origin);
    if (result.extracted.destination) setDestination(result.extracted.destination);
    if (result.extracted.via) setVia(result.extracted.via);
    if (result.extracted.busNumber) setBusNumber(result.extracted.busNumber);
    if (result.extracted.location) setLocation(result.extracted.location);
    setShowVoice(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!description.trim()) return setError(t('formDescriptionRequired'));
    if (!origin.trim() || !destination.trim()) return setError(t('formRouteRequired'));
    setSubmitting(true);
    syncDraft();
    try {
      const result = await complaintsService.submitComplaint({
        category: selectedCategory,
        route: { origin: origin.trim(), destination: destination.trim(), via: via.trim() },
        busNumber: busNumber.trim(),
        location: location.trim() || 'Onboard bus',
        description: description.trim(),
        audioTranscript: draft.audioTranscript,
        contactPhone: phone.trim() || undefined,
        preferredContactChannel: channel,
        travelDate: draft.travelDate ?? null,
        ticketExtracted: draft.ticketExtracted ?? null,
        evidence: uploadedEvidence.map(({ storage_path, mime_type, size_bytes }) => ({ storage_path, mime_type, size_bytes })),
        idempotencyKey,
      });
      setLastSubmittedComplaint(result);
      navigate('/file-complaint/success');
    } catch {
      setError(t('formSubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-container py-10 sm:py-14 text-left max-w-4xl">
      <datalist id="kerala-stops">{keralaStops.map((stop) => <option key={stop} value={stop} />)}</datalist>
      <div className="mb-8 space-y-2">
        <div className="text-[12px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formEyebrow')}</div>
        <h1 className="text-[34px] sm:text-[46px] font-extrabold text-[var(--text-primary)] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
          {t('formHeading')}
        </h1>
        <p className="text-[16px] text-[var(--text-secondary)] max-w-2xl leading-relaxed">{t('formSubheading')}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--semantic-error)] text-[var(--semantic-error)] text-[14px] flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formProblemLabel')}</p>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{t('formProblemHeading')}</h2>
            </div>
            <button type="button" onClick={() => setShowVoice((current) => !current)} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--brand)] hover:underline">
              <Mic className="w-4 h-4" />{showVoice ? t('formHideVoice') : t('formSpeak')}
            </button>
          </div>
          <div className="relative">
            <textarea
              rows={5}
              value={description}
              onChange={(event) => handleDescriptionChange(event.target.value)}
              placeholder={t('formDescriptionPlaceholder')}
              className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[12px] p-4 pr-14 text-[15px] focus:outline-none focus:border-[var(--brand)] placeholder:text-[var(--text-muted)] leading-relaxed"
            />
            <button type="button" onClick={() => setShowVoice(true)} aria-label={t('formSpeak')} className={`absolute right-3 top-3 w-10 h-10 rounded-full grid place-items-center border transition-colors ${showVoice ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'bg-[var(--bg-primary)] text-[var(--brand)] border-[var(--border-standard)] hover:border-[var(--brand)]'}`}>
              <Mic className="w-4 h-4" />
            </button>
          </div>
          {showVoice && <VoiceRecorder onTranscriptionComplete={handleVoiceComplete} onCancel={() => setShowVoice(false)} />}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formCategoryLabel')}</p>
              <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{language === 'ml' ? activeCategory.labelMl : activeCategory.labelEn}</h2>
            </div>
            <button type="button" onClick={() => setShowCategories((current) => !current)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--brand)]">
              {showCategories ? t('formHideCategories') : t('formChangeCategory')}
              {showCategories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
          {showCategories && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COMPLAINT_CATEGORIES.map((category) => (
                <CategoryCard key={category.id} category={category} compact isSelected={selectedCategory === category.id} onSelect={() => {
                  setSelectedCategory(category.id);
                  setHasSelectedCategory(true);
                  setShowCategories(false);
                }} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formTicketLabel')}</p>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{t('formTicketHeading')}</h2>
            <p className="text-[14px] text-[var(--text-secondary)] mt-1">{t('formTicketSubheading')}</p>
          </div>
          <div className="p-4 rounded-[12px] bg-[var(--surface-primary)] border border-[var(--border-standard)]">
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" id="ticket-photo" accept="image/*" onChange={handleTicketUpload} className="hidden" />
              <label htmlFor="ticket-photo" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] border border-[var(--border-standard)] text-[13px] font-semibold cursor-pointer hover:border-[var(--brand)]">
                <Ticket className="w-4 h-4 text-[var(--brand)]" />{ticketStatus === 'reading' ? t('formReadingTicket') : t('formUploadTicket')}
              </label>
              {ticketStatus === 'reading' && <div className="h-2 flex-1 min-w-[160px] rounded-full bg-[var(--bg-primary)] overflow-hidden"><div className="h-full w-2/3 rounded-full bg-[var(--brand)] animate-pulse" /></div>}
              {ticketStatus === 'reading' && <span className="text-[12px] text-[var(--text-secondary)]">{t('formExtracting')}</span>}
            </div>
            {ticketStatus === 'read' && <div className="mt-3 flex items-start gap-2 text-[13px] text-[var(--text-secondary)]"><CheckCircle2 className="w-4 h-4 text-[var(--brand)] mt-0.5 shrink-0" /><span>{t('formTicketRead')} {ticketFields.map((field) => field.replace(/_/g, ' ')).join(', ')}.</span></div>}
            {(ticketStatus === 'failed' || ticketStatus === 'unavailable') && <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{ticketStatus === 'failed' ? t('formTicketFailed') : t('formTicketUnavailable')}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formJourneyLabel')}</p>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{t('formJourneyHeading')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('formFrom')} value={origin} onChange={(event) => setOrigin(event.target.value)} list="kerala-stops" placeholder={t('formFromPlaceholder')} />
            <Input label={t('formTo')} value={destination} onChange={(event) => setDestination(event.target.value)} list="kerala-stops" placeholder={t('formToPlaceholder')} />
            <Input label={t('formVia')} value={via} onChange={(event) => setVia(event.target.value)} placeholder={t('formOptionalPlaceholder')} />
            <Input label={t('formBusNumber')} value={busNumber} onChange={(event) => setBusNumber(event.target.value)} placeholder={t('formBusPlaceholder')} />
            <Input label={t('formLocation')} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t('formLocationPlaceholder')} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formEvidenceLabel')}</p>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{t('formEvidenceHeading')}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" id="evidence-upload" accept="image/*,video/*,application/pdf" onChange={handleEvidenceUpload} className="hidden" />
            <label htmlFor="evidence-upload" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] border border-[var(--border-standard)] text-[13px] font-semibold cursor-pointer hover:border-[var(--brand)]">
              <Upload className="w-4 h-4 text-[var(--brand)]" />{uploadingEvidence ? t('formUploading') : t('formAddEvidence')}
            </label>
            {evidenceFiles.map((file, index) => <span key={`${file}-${index}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] bg-[var(--surface-primary)] border border-[var(--border-standard)] text-[12px]"><Paperclip className="w-3.5 h-3.5" />{file}<button type="button" onClick={() => removeEvidence(index)} aria-label={`${t('formRemove')} ${file}`}><X className="w-3.5 h-3.5" /></button></span>)}
          </div>
        </section>

        <section className="space-y-4 border-t border-[var(--border-standard)] pt-7">
          <div>
            <p className="text-[11px] font-mono font-bold tracking-wider text-[var(--brand)] uppercase">{t('formContactLabel')}</p>
            <h2 className="text-[22px] font-bold text-[var(--text-primary)]">{t('formContactHeading')}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('formPhone')} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('formPhonePlaceholder')} />
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[var(--text-primary)]" htmlFor="contact-channel">{t('formContactChannel')}</label>
              <select id="contact-channel" value={channel} onChange={(event) => setChannel(event.target.value as 'whatsapp' | 'sms' | 'email')} className="w-full bg-[var(--surface-primary)] text-[var(--text-primary)] border border-[var(--border-standard)] rounded-[10px] py-2.5 px-3 text-[14px] h-[48px] focus:outline-none focus:border-[var(--brand)]">
                <option value="whatsapp">{t('formWhatsapp')}</option>
                <option value="sms">{t('formSms')}</option>
                <option value="email">{t('formEmail')}</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[var(--border-standard)] pt-6">
        <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]"><MapPin className="w-4 h-4 text-[var(--brand)]" />{t('formPrivacy')}</div>
        <Button type="submit" size="lg" isLoading={submitting} className="w-full sm:w-auto px-8">{submitting ? t('formSubmitting') : t('submitComplaint')}</Button>
      </div>
    </form>
  );
};
