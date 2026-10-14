import { useLanguage } from '../../hooks/useLanguage';
export function LanguageToggle() {
  const {language, setLanguage} = useLanguage();
  return <div className="inline-flex gap-1 p-1 border border-[var(--border-standard)] rounded-lg text-xs" role="group" aria-label={language === 'ml' ? 'ഭാഷ തിരഞ്ഞെടുക്കുക' : 'Choose language'}>
    <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={`px-2 py-1 rounded ${language === 'en' ? 'bg-[var(--brand)] text-white' : ''}`}>English</button>
    <button type="button" aria-pressed={language === 'ml'} onClick={() => setLanguage('ml')} className={`px-2 py-1 rounded ${language === 'ml' ? 'bg-[var(--brand)] text-white' : ''}`}>മലയാളം</button>
  </div>;
}
