import { useText } from '../hooks/useText';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileEdit, Mic, Ticket, X } from 'lucide-react';
import { useComplaintDraft } from '../hooks/useComplaintDraft';
import { useLanguage } from '../hooks/useLanguage';
import { complaintsService, lookupService } from '../lib/api';
import type { TicketExtract } from '../lib/api/complaintsService';
import { COMPLAINT_CATEGORIES } from '../lib/constants';
import { editedTicket, journeyFromTicket, TICKET_FIELDS } from '../lib/ticketJourney';
import type { JourneyValues, TicketField } from '../lib/ticketJourney';
import type { ComplaintCategory } from '../types';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { VoiceRecorder } from '../components/voice/VoiceRecorder';

export function FileComplaint() {
  const tx = useText();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { draft, updateDraft } = useComplaintDraft();
  const { language } = useLanguage();
  const [step, setStep] = useState(params.get('step') === '2' && draft.origin ? 2 : 1);
  const [journey, setJourney] = useState<JourneyValues>(() => ({
    ...journeyFromTicket(draft.ticketExtracted as Partial<TicketExtract>),
    origin: draft.origin || '', destination: draft.destination || '', bus_number: draft.busNumber || '',
    travel_date: draft.travelDate || '', via: draft.via || '',
  }));
  const [journeyReady, setJourneyReady] = useState(Boolean(draft.origin || draft.ticketExtracted));
  const [ticketData, setTicketData] = useState<Record<string, unknown> | null>(draft.ticketExtracted ?? null);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'reading' | 'read' | 'failed'>(draft.ticketExtracted ? 'read' : 'idle');
  const [filledFields, setFilledFields] = useState<TicketField[]>([]);
  const [description, setDescription] = useState(draft.description || '');
  const [inputMode, setInputMode] = useState<'type' | 'voice'>(params.get('mode') === 'voice' ? 'voice' : 'type');
  const [category, setCategory] = useState<ComplaintCategory>(draft.category);
  const [location, setLocation] = useState(draft.location || '');
  const [evidence, setEvidence] = useState(draft.uploadedEvidence || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [stops, setStops] = useState<string[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    let active = true;
    lookupService.searchRoutes('', 200).then(routes => {
      if (active) setStops([...new Set(routes.flatMap(r => [r.origin, r.destination]))].sort());
    }).catch(() => {});
    return () => { active = false; sequence.current++; timeouts.current.forEach(clearTimeout); };
  }, []);
  const updateJourney = (key: TicketField, value: string) => setJourney(previous => ({ ...previous, [key]: value }));
  const saveJourney = () => updateDraft({
    origin: journey.origin.trim(), destination: journey.destination.trim(), busNumber: journey.bus_number.trim(),
    travelDate: journey.travel_date || null, via: journey.via.trim(), location: location.trim(),
    ticketExtracted: editedTicket(journey, ticketData), uploadedEvidence: evidence, evidenceFiles: evidence.map(e => e.name),
    description: description.trim(), category,
  });
  async function readTicket(file: File) {
    if (busy) return;
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { setError('Choose a JPG, PNG or supported image up to 20 MB.'); return; }
    const current = ++sequence.current;
    timeouts.current.forEach(clearTimeout);
    setBusy(true); setError(null); setAttachmentError(null); setTicketStatus('reading'); setFilledFields([]);
    const attachment = complaintsService.uploadEvidence(file).then(up => {
      if (current === sequence.current) setEvidence(previous => [...previous, { ...up, name: file.name }]);
    }).catch(() => {
      if (current === sequence.current) setAttachmentError('Journey details can still be used, but the ticket photo was not saved. Retry attaching it below.');
    });
    try {
      const extracted = await complaintsService.extractTicket(file);
      if (current !== sequence.current) return;
      const values = journeyFromTicket(extracted);
      const populated = TICKET_FIELDS.filter(([key]) => values[key]);
      setJourneyReady(true);
      if (!extracted || !populated.length) {
        setTicketStatus('failed'); setError('No readable journey details were found. Try a clearer image or enter the details yourself.');
      } else {
        setTicketData(extracted as unknown as Record<string, unknown>);
        setJourney(journeyFromTicket(null));
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (let index = 0; index < populated.length; index++) {
          if (!reduced) await new Promise<void>(resolve => { timeouts.current.push(setTimeout(resolve, 90)); });
          if (current !== sequence.current) return;
          const [key] = populated[index];
          setJourney(previous => ({ ...previous, [key]: values[key] }));
          setFilledFields(previous => [...previous, key]);
        }
        setTicketStatus('read');
      }
    } catch {
      if (current === sequence.current) { setTicketStatus('failed'); setJourneyReady(true); setError('Ticket reading could not finish. Retry the photo or enter the journey details manually.'); }
    } finally { await attachment; if (current === sequence.current) setBusy(false); }
  }
  async function attach(file: File) {
    if (busy) return;
    setBusy(true); setAttachmentError(null);
    try { const up = await complaintsService.uploadEvidence(file); setEvidence(previous => [...previous, { ...up, name: file.name }]); }
    catch { setAttachmentError('Could not attach this file. Try again.'); }
    finally { setBusy(false); }
  }
  function proceed() {
    setError(null); if (busy) return;
    if (!journey.origin.trim() || !journey.destination.trim()) { setError('Enter the starting and destination stops before continuing.'); return; }
    saveJourney(); setStep(2); setParams({ step: '2', mode: inputMode }); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function review() {
    if (!description.trim()) { setError('Describe what happened before reviewing your complaint.'); return; }
    saveJourney(); navigate('/file-complaint/review');
  }
  return <div className="app-container max-w-3xl py-10 sm:py-14 space-y-7">
    <datalist id="journey-stops">{stops.map(stop => <option key={stop} value={stop} />)}</datalist>
    <div className="space-y-2">
      <p className="text-[12px] font-mono font-bold text-[var(--brand)]">{step === 1 ? tx("STEP 01 / 03") : tx("STEP 02 / 03")}</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]">{step === 1 ? tx("Start with your ticket.") : tx("Describe the problem.")}</h1>
      <p className="text-[var(--text-secondary)]">{step === 1 ? tx("Upload your ticket. We’ll fill the printed details, then you can check and edit every field.") : tx("Tell us what happened, where it happened and how it affected your journey. Type or speak in Malayalam or English.")}</p>
    </div>
    {error && <p role="alert" className="p-4 border rounded-xl text-[var(--semantic-error)]">{tx(error)}</p>}
    {step === 1 ? <>
      <section className="p-5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-standard)] space-y-3" aria-live="polite" aria-busy={busy}>
        <h2 className="font-bold text-lg">{tx("Upload your ticket")}</h2>
        <input ref={uploadRef} id="ticket-photo" type="file" accept="image/*" disabled={busy} className="hidden" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readTicket(file); }} />
        <div className="flex flex-wrap gap-3 items-center">
          <Button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} icon={<Ticket className="w-4 h-4" />}>{ticketStatus === 'reading' ? tx("Reading and filling your ticket…") : tx("Upload ticket photo")}</Button>
          <span className="text-xs text-[var(--text-muted)]">{tx("Images up to 20 MB")}</span>
          {!journeyReady && <Button type="button" variant="secondary" disabled={busy} onClick={() => setJourneyReady(true)}>{tx("Continue without a ticket")}</Button>}
        </div>
        {ticketStatus === 'read' && <p className="flex items-center gap-2 text-[var(--brand)]"><CheckCircle2 className="w-4 h-4" />{tx("Ticket read. The filled boxes below are editable.")}</p>}
        {attachmentError && <p role="alert" className="text-sm text-[var(--semantic-error)]">{attachmentError}</p>}
      </section>
      {journeyReady && <section className="space-y-4" aria-label={tx("Check your journey")}>
        <h2 className="font-bold text-2xl">{tx("Check your journey")}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{tx("Edit any box directly. Empty fields were not printed or could not be read. Optional details can be left blank.")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TICKET_FIELDS.map(([key, label, type]) => <div key={key} className={filledFields.includes(key) ? 'ticket-field-filled' : ''}>
            <Input id={`journey-${key}`} label={label} type={type} value={journey[key]} disabled={busy}
              required={key === 'origin' || key === 'destination'} list={key === 'origin' || key === 'destination' ? 'journey-stops' : undefined}
              helperText={filledFields.includes(key) ? 'Filled from your ticket · editable' : key === 'origin' || key === 'destination' ? 'Required' : 'Optional · enter only if known'}
              onChange={event => updateJourney(key, event.target.value)} />
          </div>)}
          <Input id="incident-location" label={tx("Where on the bus or at the stop did the problem happen?")} value={location} helperText={tx("Optional · this describes the incident, not the ticket’s boarding stop")} onChange={event => setLocation(event.target.value)} />
        </div>
        <div className="space-y-2 pt-3">
          <h3 className="font-semibold">{tx("Supporting photo or document")}</h3>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => attachmentRef.current?.click()}>{tx('Attach file')}</Button>
          <input ref={attachmentRef} id="supporting-file" type="file" accept="image/*,.pdf,video/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void attach(file); }} className="hidden" />
          {evidence.map((file, index) => <div key={`${file.storage_path}-${index}`} className="flex justify-between gap-3 text-sm"><span>{file.name}</span><button type="button" aria-label={tx("Remove attachment")} disabled={busy} onClick={() => setEvidence(previous => previous.filter((_, i) => i !== index))}><X className="w-4 h-4" /></button></div>)}
        </div>
        <Button type="button" disabled={busy} onClick={proceed} icon={<ArrowRight className="w-4 h-4" />}>{tx("Details look right — describe the problem")}</Button>
      </section>}
    </> : <>
      <button type="button" className="text-[var(--brand)] flex items-center gap-2" onClick={() => { saveJourney(); setStep(1); setParams({step:'1'}); setError(null); }}><ArrowLeft className="w-4 h-4" />{tx("Edit journey details")}</button>
      <p className="font-semibold">{journey.origin} → {journey.destination}{journey.bus_number ? ` · ${journey.bus_number}` : ''}</p>
      <div className="flex gap-3" role="group" aria-label={tx("Describe by typing or speaking")}>
        <Button type="button" variant={inputMode === 'type' ? 'primary' : 'secondary'} aria-pressed={inputMode === 'type'} onClick={() => setInputMode('type')} icon={<FileEdit className="w-4 h-4" />}>{tx("Type")}</Button>
        <Button type="button" variant={inputMode === 'voice' ? 'primary' : 'secondary'} aria-pressed={inputMode === 'voice'} onClick={() => setInputMode('voice')} icon={<Mic className="w-4 h-4" />}>{tx("Speak")}</Button>
      </div>
      {inputMode === 'voice' && <VoiceRecorder onTranscriptionComplete={result => {
        setDescription(result.transcript); if (result.extracted.category) setCategory(result.extracted.category);
        if (result.extracted.location) setLocation(result.extracted.location);
        updateDraft({audioTranscript:result.transcript});
      }} />}
      <div className="space-y-2">
        <label htmlFor="problem-description" className="font-semibold">{tx("Describe the problem")}</label>
        <textarea id="problem-description" rows={5} value={description} onChange={event => setDescription(event.target.value)} placeholder={tx("What happened? Where and when did it happen?")} className="w-full border border-[var(--border-standard)] rounded-xl p-4 bg-[var(--surface-primary)]" />
        <p className="text-sm text-[var(--text-muted)]">{tx("If you spoke, your words appear here. You can correct them before submitting.")}</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="problem-category" className="font-semibold">{tx("Complaint category")}</label>
        <select id="problem-category" value={category} onChange={event => setCategory(event.target.value as ComplaintCategory)} className="w-full border rounded-xl p-3 bg-[var(--surface-primary)]">{COMPLAINT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{language === 'ml' ? c.labelMl : c.labelEn}</option>)}</select>
      </div>
      <Button type="button" onClick={review} disabled={!description.trim()} icon={<ArrowRight className="w-4 h-4" />}>{tx("Review complaint")}</Button>
    </>}
  </div>;
}
