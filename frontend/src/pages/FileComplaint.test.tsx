import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '../context/LanguageContext';
import { ComplaintDraftProvider } from '../context/ComplaintDraftContext';
import { FileComplaint } from './FileComplaint';
import { ReviewComplaint } from './ReviewComplaint';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { journeyFromTicket, editedTicket } from '../lib/ticketJourney';

const service = vi.hoisted(() => ({extractTicket:vi.fn(),uploadEvidence:vi.fn(),searchRoutes:vi.fn()}));
vi.mock('../lib/api',() => ({complaintsService:service,lookupService:service}));
vi.mock('../components/voice/VoiceRecorder',()=>({VoiceRecorder:({onTranscriptionComplete}:{onTranscriptionComplete:(value:unknown)=>void})=><button onClick={()=>onTranscriptionComplete({transcript:'The driver did not stop at my stop.',extracted:{origin:'Wrong origin',destination:'Wrong destination',category:'route_service'}})}>Test spoken description</button>}));
const ticket = {origin:'Guruvayur',destination:'Ernakulam',bus_number:'KL-15-A-4892',travel_date:'2026-10-14',travel_time:'09:30',via:'Thrissur',landmark:'KSRTC stand',seat_number:'12',ticket_no:'TEST-123',pnr:'TEST-PNR',depot:'Guruvayur',service_type:'SUPER FAST',trip_code:'0930GVR',depot_phone:'04871234567',has_qr:true};
function mount(){return render(<LanguageProvider><ComplaintDraftProvider><MemoryRouter initialEntries={['/file-complaint']}><LanguageToggle/><Routes><Route path="/file-complaint" element={<FileComplaint/>}/><Route path="/file-complaint/review" element={<ReviewComplaint/>}/></Routes></MemoryRouter></ComplaintDraftProvider></LanguageProvider>);}
beforeEach(()=>{
  localStorage.clear(); vi.clearAllMocks();
  vi.stubGlobal('matchMedia',()=>({matches:true}));vi.stubGlobal('scrollTo',vi.fn());
  service.extractTicket.mockResolvedValue(ticket);service.uploadEvidence.mockResolvedValue({storage_path:'test/synthetic.png',mime_type:'image/png',size_bytes:100});service.searchRoutes.mockResolvedValue([]);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function upload(){fireEvent.change(document.getElementById('ticket-photo')!,{target:{files:[new File(['synthetic'],'ticket.png',{type:'image/png'})]}});await waitFor(()=>expect((screen.getByLabelText('Starting stop') as HTMLInputElement).value).toBe('Guruvayur'));await waitFor(()=>expect((screen.getByLabelText('Starting stop') as HTMLInputElement).disabled).toBe(false));}
describe('Ticket-first complaint flow',()=>{
  it('maps every extracted field into editable boxes and preserves corrections through review',async()=>{
    mount();expect(screen.queryByLabelText('Starting stop')).toBeNull();expect(screen.queryByLabelText('Describe the problem')).toBeNull();await upload();
    expect((screen.getByLabelText('Destination stop') as HTMLInputElement).value).toBe('Ernakulam');
    expect((screen.getByLabelText('Bus registration / fleet number') as HTMLInputElement).value).toBe(ticket.bus_number);
    expect((screen.getByLabelText('Travel date') as HTMLInputElement).value).toBe(ticket.travel_date);
    expect((screen.getByLabelText('Via / corridor') as HTMLInputElement).value).toBe('Thrissur');
    expect((screen.getByLabelText('Seat number') as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText('PNR / booking reference') as HTMLInputElement).value).toBe('TEST-PNR');
    fireEvent.change(screen.getByLabelText('Destination stop'),{target:{value:'Aluva'}});
    fireEvent.click(screen.getByRole('button',{name:'Details look right — describe the problem'}));
    fireEvent.change(screen.getByLabelText('Describe the problem'),{target:{value:'The bus skipped my stop.'}});
    fireEvent.click(screen.getByRole('button',{name:'Review complaint'}));expect(screen.getAllByText('Aluva')).toHaveLength(2);expect(screen.getByText('The bus skipped my stop.')).toBeTruthy();
  });
  it('switches to Malayalam without losing the filled ticket or edits',async()=>{
    mount();await upload();fireEvent.change(screen.getByLabelText('Destination stop'),{target:{value:'Aluva'}});fireEvent.click(screen.getByRole('button',{name:'മലയാളം'}));
    expect(screen.getByRole('heading',{name:'യാത്രാ വിവരങ്ങൾ പരിശോധിക്കുക'})).toBeTruthy();expect((screen.getByLabelText('എത്തേണ്ട സ്റ്റോപ്പ്') as HTMLInputElement).value).toBe('Aluva');
    expect(screen.getByRole('button',{name:'വിവരങ്ങൾ ശരിയാണ് — പ്രശ്നം വിവരിക്കൂ'})).toBeTruthy();
  });
  it('speech fills an editable description without overwriting the confirmed ticket journey',async()=>{
    mount();await upload();fireEvent.click(screen.getByRole('button',{name:'Details look right — describe the problem'}));fireEvent.click(screen.getByRole('button',{name:'Speak'}));fireEvent.click(screen.getByText('Test spoken description'));
    expect((screen.getByLabelText('Describe the problem') as HTMLTextAreaElement).value).toBe('The driver did not stop at my stop.');
    fireEvent.click(screen.getByRole('button',{name:'Edit journey details'}));expect((screen.getByLabelText('Starting stop') as HTMLInputElement).value).toBe('Guruvayur');
  });
  it('still fills the journey when attachment storage fails, with an honest error',async()=>{
    service.uploadEvidence.mockRejectedValue(new Error('storage unavailable'));mount();await upload();expect(screen.getByRole('alert').textContent).toContain('ticket photo was not saved');
  });
  it('allows manual recovery from unreadable tickets without fabricated values',async()=>{
    service.extractTicket.mockResolvedValue({has_qr:false});mount();fireEvent.change(document.getElementById('ticket-photo')!,{target:{files:[new File(['synthetic'],'ticket.png',{type:'image/png'})]}});
    await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('No readable journey details'));
    expect((screen.getByLabelText('Starting stop') as HTMLInputElement).value).toBe('');expect((screen.getByLabelText('Destination stop') as HTMLInputElement).value).toBe('');
  });
  it('preserves missing fields as empty and saves edits into ticket metadata',()=>{
    const values=journeyFromTicket({origin:'Guruvayur',destination:'Ernakulam'});expect(values.bus_number).toBe('');expect(values.via).toBe('');values.destination='Aluva';expect(editedTicket(values,{has_qr:true})).toMatchObject({destination:'Aluva',bus_number:null,has_qr:true});
  });
});


