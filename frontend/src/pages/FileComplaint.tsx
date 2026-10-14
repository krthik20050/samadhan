import { useText } from '../hooks/useText';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Ticket, X } from 'lucide-react';
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
import { VoiceField } from '../components/voice/VoiceField';
import { newIdempotencyKey } from '../context/ComplaintDraftContext';

export function FileComplaint() {
  const tx = useText();
  const navigate = useNavigate();

  const { draft, updateDraft, setLastSubmittedComplaint } = useComplaintDraft();
  const { language } = useLanguage();
  const [journey, setJourney] = useState<JourneyValues>(() => ({
    ...journeyFromTicket(draft.ticketExtracted as Partial<TicketExtract>),
    origin: draft.origin || '', destination: draft.destination || '', bus_number: draft.busNumber || '',
    travel_date: draft.travelDate || '', via: draft.via || '',
  }));
  const [ticketData, setTicketData] = useState<Record<string, unknown> | null>(draft.ticketExtracted ?? null);
  const [ticketStatus, setTicketStatus] = useState<'idle' | 'reading' | 'read' | 'failed'>(draft.ticketExtracted ? 'read' : 'idle');
  const [filledFields, setFilledFields] = useState<TicketField[]>([]);
  const [description, setDescription] = useState(draft.description || '');
  const [category, setCategory] = useState<ComplaintCategory>(draft.category);
  const [location, setLocation] = useState(draft.location || '');
  const [evidence, setEvidence] = useState(draft.uploadedEvidence || []);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeVoice,setActiveVoice]=useState<'location'|'description'|null>(null);
  const [phone,setPhone] = useState(draft.contactPhone || '');
  const [channel,setChannel] = useState<'whatsapp'|'sms'|'email'>(draft.preferredContactChannel || 'whatsapp');
  const [idempotencyKey] = useState(()=>draft.idempotencyKey ?? newIdempotencyKey());
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
    description: description.trim(), category, contactPhone:phone.trim(), preferredContactChannel:channel, idempotencyKey,
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
      if (current === sequence.current) { setTicketStatus('failed'); setError('Ticket reading could not finish. Retry the photo or enter the journey details manually.'); }
    } finally { await attachment; if (current === sequence.current) setBusy(false); }
  }
  async function attach(file: File) {
    if (busy) return;
    setBusy(true); setAttachmentError(null);
    try { const up = await complaintsService.uploadEvidence(file); setEvidence(previous => [...previous, { ...up, name: file.name }]); }
    catch { setAttachmentError('Could not attach this file. Try again.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    setError(null);
    if (busy || submitting || activeVoice) return;
    if (!journey.origin.trim() || !journey.destination.trim()) { setError('Enter the starting and destination stops before continuing.'); return; }
    if (description.trim().length < 10) { setError('Describe the problem in at least 10 characters.'); return; }
    saveJourney(); setSubmitting(true);
    try {
      const result=await complaintsService.submitComplaint({category,
        route:{origin:journey.origin.trim(),destination:journey.destination.trim(),via:journey.via.trim()},
        busNumber:journey.bus_number.trim(),location:location.trim()||'Onboard bus',description:description.trim(),
        contactPhone:phone.trim()||undefined,preferredContactChannel:channel,travelDate:journey.travel_date||null,
        ticketExtracted:editedTicket(journey,ticketData),evidence:evidence.map(file=>({storage_path:file.storage_path,mime_type:file.mime_type,size_bytes:file.size_bytes})),idempotencyKey,
      });
      setLastSubmittedComplaint(result); navigate('/file-complaint/success');
    } catch { setError('We couldn’t submit your complaint. Your details are still here. Please try again.'); }
    finally { setSubmitting(false); }
  }
  return <div className="app-container py-10 sm:py-14 space-y-7" style={{maxWidth:900}}>
    <datalist id="journey-stops">{stops.map(stop => <option key={stop} value={stop} />)}</datalist>
    <div className="space-y-2">
      <p className="text-[12px] font-mono font-bold text-[var(--brand)]">{tx('YOUR COMPLAINT')}</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)]">{tx('Tell us what happened.')}</h1>
      <p className="text-[var(--text-secondary)]">{tx('Upload a ticket to fill your journey, then type or speak your complaint. Everything is on this page.')}</p>
    </div>
    {error && <p role="alert" className="p-4 border rounded-xl text-[var(--semantic-error)]">{tx(error)}</p>}
    <>
      <section className="p-5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-standard)] space-y-3" aria-live="polite" aria-busy={busy}>
        <h2 className="font-bold text-lg">{tx("Upload your ticket")}</h2>
        <input ref={uploadRef} id="ticket-photo" type="file" accept="image/*" disabled={busy} className="hidden" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void readTicket(file); }} />
        <div className="flex flex-wrap gap-3 items-center">
          <Button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} icon={<Ticket className="w-4 h-4" />}>{ticketStatus === 'reading' ? tx("Reading and filling your ticket…") : tx("Upload ticket photo")}</Button>
          <span className="text-xs text-[var(--text-muted)]">{tx("Images up to 20 MB")}</span>
        </div>
        {ticketStatus === 'read' && <p className="flex items-center gap-2 text-[var(--brand)]"><CheckCircle2 className="w-4 h-4" />{tx("Ticket read. The filled boxes below are editable.")}</p>}
        {attachmentError && <p role="alert" className="text-sm text-[var(--semantic-error)]">{tx(attachmentError)}</p>}
      </section>
      <section className="space-y-4" aria-label={tx("Check your journey")}>
        <h2 className="font-bold text-2xl">{tx("Check your journey")}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{tx("Edit any box directly. Empty fields were not printed or could not be read. Optional details can be left blank.")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TICKET_FIELDS.map(([key, label, type]) => <div key={key} className={filledFields.includes(key) ? 'ticket-field-filled' : ''}>
            <Input id={`journey-${key}`} label={label} type={type} value={journey[key]} disabled={busy}
              required={key === 'origin' || key === 'destination'} list={key === 'origin' || key === 'destination' ? 'journey-stops' : undefined}
              helperText={filledFields.includes(key) ? 'Filled from your ticket · editable' : key === 'origin' || key === 'destination' ? 'Required' : 'Optional · enter only if known'}
              onChange={event => updateJourney(key, event.target.value)} />
          </div>)}
        </div>
        <div className="space-y-2 pt-3">
          <h3 className="font-semibold">{tx("Supporting photo or document")}</h3>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => attachmentRef.current?.click()}>{tx('Attach file')}</Button>
          <input ref={attachmentRef} id="supporting-file" type="file" accept="image/*,.pdf,video/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void attach(file); }} className="hidden" />
          {evidence.map((file, index) => <div key={`${file.storage_path}-${index}`} className="flex justify-between gap-3 text-sm"><span>{file.name}</span><button type="button" aria-label={tx("Remove attachment")} disabled={busy} onClick={() => setEvidence(previous => previous.filter((_, i) => i !== index))}><X className="w-4 h-4" /></button></div>)}
        </div>
      </section>
    </>
    <section className="space-y-6 pt-6 border-t border-[var(--border-standard)]">
      <h2 className="font-bold text-2xl">{tx('What happened?')}</h2>
      <VoiceField id="incident-location" label="Where were you on the bus?" value={location} onChange={setLocation} isOpen={activeVoice==='location'} onOpenChange={open=>setActiveVoice(open?'location':null)} placeholder="For example, near the back door or at the boarding stop" helperText="Optional. Type or use the mic to tell us where the problem happened."/>
      <VoiceField id="problem-description" label="Describe the problem" value={description} onChange={setDescription} isOpen={activeVoice==='description'} onOpenChange={open=>setActiveVoice(open?'description':null)} multiline placeholder="What happened? Where and when did it happen?" helperText="Speak in Malayalam or English, or type. You can edit every word before submitting."/>
      <div className="space-y-2">
        <label htmlFor="problem-category" className="font-semibold">{tx("Complaint category")}</label>
        <select id="problem-category" value={category} onChange={event => setCategory(event.target.value as ComplaintCategory)} className="w-full border rounded-xl p-3 bg-[var(--surface-primary)]">{COMPLAINT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{language === 'ml' ? c.labelMl : c.labelEn}</option>)}</select>
      </div>
      <details className="p-4 border rounded-xl border-[var(--border-standard)]">
        <summary className="cursor-pointer font-semibold">{tx('Contact for updates (optional)')}</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Input label={tx('Mobile Number (Optional)')} value={phone} onChange={event=>setPhone(event.target.value)} type="tel"/>
          <div><label htmlFor="updates-channel" className="text-sm font-semibold">{tx('Updates Channel')}</label><select id="updates-channel" className="w-full border rounded-xl p-3 mt-1 bg-[var(--surface-primary)]" value={channel} onChange={event=>setChannel(event.target.value as typeof channel)}><option value="whatsapp">{tx('WhatsApp')}</option><option value="sms">{tx('SMS')}</option><option value="email">{tx('Email')}</option></select></div>
        </div>
      </details>
      <p className="text-sm text-[var(--text-secondary)]">{tx('Check your details above. Submit once and keep your reference number.')}</p>
      {activeVoice&&<p className="text-sm text-[var(--brand)]">{tx('Finish or close voice input before submitting.')}</p>}
      <Button type="button" onClick={()=>void submit()} disabled={busy || submitting || Boolean(activeVoice)} isLoading={submitting} fullWidth icon={<ArrowRight className="w-4 h-4" />}>{tx(submitting?'Submitting your complaint…':'Submit Complaint')}</Button>
    </section>
  </div>;
}
