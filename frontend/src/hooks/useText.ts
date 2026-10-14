import { useLanguage } from './useLanguage';
import { UI_MESSAGES } from '../lib/ui-messages';
import { TRANSLATIONS } from '../lib/translations';
const normalize = (text: string) => text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const dictionary = new Map(Object.entries(UI_MESSAGES).map(([en, ml]) => [normalize(en), ml]));
for (const entry of Object.values(TRANSLATIONS)) dictionary.set(normalize(entry.en), entry.ml);
export function translateText(text: string | null | undefined, language: 'en' | 'ml'): string {
  if (!text) return '';
  if (language === 'en') return text;
  return dictionary.get(normalize(text)) ?? text;
}
export function useText() {
  const {language} = useLanguage();
  return (text: string | null | undefined) => translateText(text, language);
}
