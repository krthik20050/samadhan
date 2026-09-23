import type { ComplaintCategory } from '../types';


export interface CategoryMeta {
  id: ComplaintCategory;
  labelEn: string;
  labelMl: string;
  descriptionEn: string;
  descriptionMl: string;
  iconName: string;
  badgeColor: string;
  slaHours: number;
}

export const COMPLAINT_CATEGORIES: CategoryMeta[] = [
  {
    id: 'cleanliness',
    labelEn: 'Cleanliness & Hygiene',
    labelMl: 'ശുചിത്വം & ആരോഗ്യം',
    descriptionEn: 'Dirty seats, unwashed bus interiors, pest presence or litter',
    descriptionMl: 'സീറ്റുകളിലെ അഴുക്ക്, വൃത്തിഹീനമായ ബസ്സ്, മാലിന്യങ്ങൾ',
    iconName: 'Sparkles',
    badgeColor: '#0F5C4D',
    slaHours: 24,
  },
  {
    id: 'driver_conductor',
    labelEn: 'Driver & Conductor',
    labelMl: 'ഡ്രൈവർ & കണ്ടക്ടർ',
    descriptionEn: 'Rash driving, skipping designated stops, ticket disputes or misconduct',
    descriptionMl: 'അശ്രദ്ധമായ ഡ്രൈവിംഗ്, സ്റ്റോപ്പുകളിൽ നിർത്താതിരിക്കൽ, അപമര്യാദ',
    iconName: 'UserCheck',
    badgeColor: '#B87516',
    slaHours: 12,
  },
  {
    id: 'safety',
    labelEn: 'Passenger Safety',
    labelMl: 'യാത്രാ സുരക്ഷ',
    descriptionEn: 'Emergency door issues, overcrowding, brake/light faults, harassment',
    descriptionMl: 'അടിയന്തര വാതിൽ പ്രശ്നങ്ങൾ, അമിത തിരക്ക്, സുരക്ഷാ വീഴ്ചകൾ',
    iconName: 'ShieldAlert',
    badgeColor: '#B64242',
    slaHours: 6,
  },
  {
    id: 'bus_condition',
    labelEn: 'Bus Condition',
    labelMl: 'ബസ്സിന്റെ അവസ്ഥ',
    descriptionEn: 'Broken windows, leaking roofs, non-functioning fans or AC',
    descriptionMl: 'തകർന്ന ജനലുകൾ, ചോർച്ച, ഫാൻ അല്ലെങ്കിൽ എസി തകരാറുകൾ',
    iconName: 'Wrench',
    badgeColor: '#386FA4',
    slaHours: 36,
  },
  {
    id: 'delay_schedule',
    labelEn: 'Delay & Schedule',
    labelMl: 'സമയക്രമവും വൈകലും',
    descriptionEn: 'Unannounced trip cancellation, severe departure or arrival delays',
    descriptionMl: 'അറിയിപ്പില്ലാതെ ട്രിപ്പ് മുടങ്ങൽ, ഗുരുതരമായ സമയതാമസം',
    iconName: 'Clock',
    badgeColor: '#5E6964',
    slaHours: 18,
  },
  {
    id: 'route_service',
    labelEn: 'Route & Stopping',
    labelMl: 'റൂട്ടും സ്റ്റോപ്പുകളും',
    descriptionEn: 'Route deviation, refusing to halt at scheduled request stops',
    descriptionMl: 'റൂട്ട് മാറ്റൽ, ഷെഡ്യൂൾ ചെയ്ത സ്റ്റോപ്പിൽ നിർത്താതിരിക്കൽ',
    iconName: 'Navigation',
    badgeColor: '#247A52',
    slaHours: 24,
  },
  {
    id: 'staff_behaviour',
    labelEn: 'Staff Behaviour',
    labelMl: 'ജീവനക്കാരുടെ പെരുമാറ്റം',
    descriptionEn: 'Disrespectful language, refusal of valid concession or pass',
    descriptionMl: 'മോശം ഭാഷ, കൺസെഷൻ നിരസിക്കൽ, മോശം സമീപനം',
    iconName: 'Users',
    badgeColor: '#B87516',
    slaHours: 18,
  },
  {
    id: 'accessibility',
    labelEn: 'Accessibility',
    labelMl: 'മുതിർന്നവർ & ഭിന്നശേഷി',
    descriptionEn: 'Issues for senior citizens, mothers with infants, physically challenged',
    descriptionMl: 'മുതിർന്ന പൗരന്മാർക്കും ഭിന്നശേഷിക്കാർക്കുമുള്ള സൗകര്യമില്ലായ്മ',
    iconName: 'HeartHandshake',
    badgeColor: '#0F5C4D',
    slaHours: 12,
  },
  {
    id: 'ticketing',
    labelEn: 'Ticketing & Concession',
    labelMl: 'ടിക്കറ്റിംഗ് & നിരക്ക്',
    descriptionEn: 'Excess fare collection, digital payment failure, change not returned',
    descriptionMl: 'അധിക നിരക്ക് ഈടാക്കൽ, ഓൺലൈൻ പെയ്മെന്റ് പരാജയം, ബാക്കി നൽകാതിരിക്കൽ',
    iconName: 'CreditCard',
    badgeColor: '#386FA4',
    slaHours: 24,
  },
  {
    id: 'other',
    labelEn: 'Other Inquiries',
    labelMl: 'മറ്റ് പരാതികൾ',
    descriptionEn: 'Lost and found, general transport feedback or station facilities',
    descriptionMl: 'നഷ്ടപ്പെട്ട സാധനങ്ങൾ, ബസ് സ്റ്റാൻഡ് സംബന്ധമായ വിവരങ്ങൾ',
    iconName: 'HelpCircle',
    badgeColor: '#5E6964',
    slaHours: 48,
  },
];

export const POPULAR_ROUTES = [
  { origin: 'Guruvayur', destination: 'Kozhikode', via: 'Ponnani - Tirur' },
  { origin: 'Thiruvananthapuram', destination: 'Ernakulam', via: 'Kollam - Alappuzha' },
  { origin: 'Palakkad', destination: 'Thrissur', via: 'Alathur - Vadakkencherry' },
  { origin: 'Kottayam', destination: 'Kumily', via: 'Kanjirappally - Mundakkayam' },
  { origin: 'Kannur', destination: 'Mananthavady', via: 'Mattannur - Nedumpoil' },
  { origin: 'Ernakulam', destination: 'Bangalore', via: 'Thrissur - Palakkad - Salem' },
];

export const ESCALATION_TIERS = [
  { level: 1, role: 'Depot Grievance Officer', roleMl: 'ഡിപ്പോ പരാതി പരിഹാര ഓഫീസർ', slaLimit: '0 - 12h' },
  { level: 2, role: 'District Transport Officer (DTO)', roleMl: 'ജില്ലാ ട്രാൻസ്പോർട്ട് ഓഫീസർ (ഡി.ടി.ഒ)', slaLimit: '12 - 24h' },
  { level: 3, role: 'Zonal Executive Director', roleMl: 'സോണൽ എക്സിക്യൂട്ടീവ് ഡയറക്ടർ', slaLimit: '24h+' },
];
