import { useEffect, useRef, useState } from 'react';
import { Mic, X } from 'lucide-react';
import { useText } from '../../hooks/useText';
import { VoiceRecorder } from './VoiceRecorder';
export function VoiceField({id,label,value,onChange,multiline=false,placeholder,helperText,isOpen,onOpenChange}: {
  id:string;label:string;value:string;onChange:(value:string)=>void;multiline?:boolean;placeholder?:string;helperText?:string;
  isOpen?:boolean;onOpenChange?:(open:boolean)=>void;
}) {
  const tx=useText();
  const [localSpeaking,setLocalSpeaking]=useState(false);
  const speaking=isOpen??localSpeaking;
  const setSpeaking=(open:boolean)=>onOpenChange?onOpenChange(open):setLocalSpeaking(open);
  const latestValue=useRef(value);
  useEffect(()=>{latestValue.current=value;},[value]);
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="font-semibold text-[var(--text-primary)]">{tx(label)}</label>
      <button type="button" aria-expanded={speaking} aria-controls={`${id}-voice`} aria-label={`${tx('Speak')}: ${tx(label)}`} onClick={()=>setSpeaking(!speaking)} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[var(--surface-secondary)] text-[var(--brand)] font-semibold text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
        {speaking?<X className="w-4 h-4"/>:<Mic className="w-4 h-4"/>}{tx(speaking?'Close voice input':'Speak')}
      </button>
    </div>
    {multiline?<textarea id={id} rows={5} maxLength={5000} value={value} onChange={event=>onChange(event.target.value)} placeholder={tx(placeholder)} className="w-full border border-[var(--border-standard)] rounded-xl p-4 bg-[var(--surface-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"/>:
      <input id={id} value={value} onChange={event=>onChange(event.target.value)} placeholder={tx(placeholder)} className="w-full border border-[var(--border-standard)] rounded-xl p-3 bg-[var(--surface-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"/>}
    {helperText&&<p className="text-sm text-[var(--text-muted)]">{tx(helperText)}</p>}
    {speaking&&<div id={`${id}-voice`} className="p-4 rounded-xl border border-[var(--border-standard)] bg-[var(--surface-primary)]"><VoiceRecorder autoStart showSamples={false} onCancel={()=>setSpeaking(false)} onTranscriptionComplete={result=>{onChange([latestValue.current.trim(),result.transcript].filter(Boolean).join(' '));setSpeaking(false);}}/></div>}
  </div>;
}
