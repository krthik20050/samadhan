export interface Translations {
  [key: string]: {
    en: string;
    ml: string;
  };
}

export const TRANSLATIONS: Translations = {
  // Brand
  brandName: { en: 'SAMADHAN', ml: 'സമാധാൻ' },
  tagline: { en: 'Different ways to report. One system to resolve.', ml: 'വ്യത്യസ്ത വഴികളിലൂടെ പരാതിപ്പെടാം. ഒറ്റ സംവിധാനത്തിലൂടെ പരിഹാരം.' },
  subtitle: {
    en: 'Kerala Public Transport Passenger Grievance & Depot Escalation Platform',
    ml: 'കേരള പൊതുഗതാഗത യാത്രാ പരാതി പരിഹാര & ഡിപ്പോ എസ്കലേഷൻ സംവിധാനം',
  },

  // Navigation
  navHome: { en: 'Home', ml: 'ഹോം' },
  navFileComplaint: { en: 'File a Complaint', ml: 'പരാതി നൽകുക' },
  navTrack: { en: 'Track Complaint', ml: 'പരാതി പരിശോധിക്കുക' },
  navPublic: { en: 'Public Insights', ml: 'പൊതു വിവരങ്ങൾ' },
  navAdmin: { en: 'Depot Portal', ml: 'ഡിപ്പോ ലോഗിൻ' },

  // Hero
  heroTitle: { en: 'Report it.\nWe’ll take it from there.', ml: 'പരാതിപ്പെടൂ.\nബാക്കി ഞങ്ങൾ ഏറ്റെടുക്കാം.' },
  heroSubtitle: {
    en: 'Report a public transport issue in seconds. SAMADHAN turns it into a structured complaint, routes it to the right depot and lets you track what happens next.',
    ml: 'നിമിഷങ്ങൾക്കുള്ളിൽ നിങ്ങളുടെ യാത്രാ പരാതി സമർപ്പിക്കാം. സമാധാൻ അത് വ്യക്തമായ രേഖയാക്കി ബന്ധപ്പെട്ട ഡിപ്പോയിലേക്ക് കൈമാറുന്നു, തുടർനടപടികൾ കൃത്യമായി പരിശോധിക്കാം.',
  },
  ctaFileComplaint: { en: 'File a Complaint', ml: 'പരാതി നൽകുക' },
  ctaTrackComplaint: { en: 'Track a Complaint', ml: 'പരാതി പരിശോധിക്കുക' },
  ctaOtherWays: { en: 'Other ways to report →', ml: 'പരാതിപ്പെടാനുള്ള മറ്റ് വഴികൾ →' },
  ctaSpeakInstead: { en: 'Speak instead', ml: 'സംസാരിച്ചു പരാതിപ്പെടാം' },
  ctaSpeak: { en: '🎙 Speak Your Complaint', ml: '🎙 പരാതി സംസാരിച്ചു പറയുക' },
  ctaFileText: { en: 'File by Typing', ml: 'എഴുതി നൽകുക' },
  ctaTrack: { en: 'Track Complaint Status', ml: 'പരാതിയുടെ നില പരിശോധിക്കുക' },

  // Trust badges
  badgeFast: { en: 'Under 60 Seconds', ml: '60 സെക്കൻഡിനുള്ളിൽ' },
  badgeDirect: { en: 'Direct Depot Assignment', ml: 'നേരിട്ട് ഡിപ്പോയിലേക്ക്' },
  badgeEscalation: { en: 'Guaranteed Escalation SLA', ml: 'നിശ്ചിത സമയപരിധി ഉറപ്പ്' },
  badgePrivacy: { en: 'Privacy Protected', ml: 'വ്യക്തിവിവരങ്ങൾ സുരക്ഷിതം' },

  // Voice Interaction
  voicePromptHeading: { en: 'Tell us what happened', ml: 'എന്താണ് സംഭവിച്ചതെന്ന് വ്യക്തമായി പറയൂ' },
  voiceInstruction: {
    en: 'Speak naturally. Mention the route, bus number if known, and the issue.',
    ml: 'സ്വാഭാവികമായി സംസാരിക്കുക. റൂട്ട്, അറിയാമെങ്കിൽ ബസ് നമ്പർ, നേരിട്ട ബുദ്ധിമുട്ട് എന്നിവ പറയുക.',
  },
  voiceExample: {
    en: '“I have a cleanliness complaint about the bus travelling from Guruvayur to Kozhikode. The seats in the middle were very dirty.”',
    ml: '“ഗുരുവായൂരിൽ നിന്ന് കോഴിക്കോട്ടേക്ക് പോകുന്ന ബസ്സിൽ നടുവിലെ സീറ്റുകൾ വളരെ വൃത്തിഹീനമായിരുന്നു. ശുചിത്വം ഉറപ്പാക്കണം.”',
  },
  listeningNow: { en: 'Listening to your voice...', ml: 'ശ്രദ്ധിച്ചു കേൾക്കുന്നു...' },
  tapToSpeak: { en: 'Tap to Speak', ml: 'സംസാരിക്കാൻ അമർത്തുക' },
  stopRecording: { en: 'Done Speaking', ml: 'സംസാരം പൂർത്തിയായി' },
  cancelRecording: { en: 'Cancel', ml: 'റദ്ദാക്കുക' },
  processingSpeech: { en: 'Extracting key details...', ml: 'വിവരങ്ങൾ വേർതിരിച്ചെടുക്കുന്നു...' },

  // Extracted Info
  understoodAs: { en: 'We understood this as:', ml: 'ഞങ്ങൾ മനസ്സിലാക്കിയ വിവരങ്ങൾ:' },
  routeLabel: { en: 'Route', ml: 'റൂട്ട്' },
  busNumberLabel: { en: 'Bus / Reg Number', ml: 'ബസ്സ് നമ്പർ' },
  categoryLabel: { en: 'Category', ml: 'വിഭാഗം' },
  locationLabel: { en: 'Location', ml: 'സ്ഥലം' },
  descriptionLabel: { en: 'Description', ml: 'വിവരണം' },
  editDetails: { en: 'Edit Details', ml: 'തിരുത്തുക' },
  looksCorrect: { en: 'Looks Correct — Continue', ml: 'ശരിയാണ് — മുന്നോട്ട് പോകുക' },

  // Review
  reviewHeading: { en: 'Please check the details before submitting', ml: 'സമർപ്പിക്കുന്നതിന് മുൻപ് വിവരങ്ങൾ പരിശോധിക്കുക' },
  reviewNote: {
    en: 'Your complaint will be verified and mapped to the official responsible depot.',
    ml: 'നിങ്ങളുടെ പരാതി പരിശോധിച്ചു ഔദ്യോഗിക റൂട്ട് മാപ്പിംഗ് പ്രകാരം ഉത്തരവാദപ്പെട്ട ഡിപ്പോയ്ക്ക് കൈമാറും.',
  },
  submitComplaint: { en: 'Submit Complaint', ml: 'പരാതി സമർപ്പിക്കുക' },
  goBackEdit: { en: 'Go Back & Edit', ml: 'പുറകിലേക്ക് പോയി തിരുത്തുക' },

  // Tracking
  trackHeading: { en: 'Track Your Grievance', ml: 'പരാതിയുടെ പുരോഗതി പരിശോധിക്കുക' },
  trackSubheading: {
    en: 'Enter your Samadhan reference number (e.g. SAM-2026-001284) to view real-time status and depot action.',
    ml: 'തത്സമയ വിവരങ്ങൾ അറിയാൻ നിങ്ങളുടെ സമാധാൻ റഫറൻസ് നമ്പർ നൽകുക.',
  },
  enterRefPlaceholder: { en: 'e.g. SAM-2026-001284', ml: 'ഉദാ: SAM-2026-001284' },
  checkStatusBtn: { en: 'Check Status', ml: 'നില പരിശോധിക്കുക' },

  // Privacy Statement
  privacyNotice: {
    en: 'Your contact information is strictly used for official grievance redressal. Public transparency reports never disclose personal identities.',
    ml: 'നിങ്ങളുടെ ഫോൺ വിവരങ്ങൾ പരാതി പരിഹാരത്തിന് മാത്രമായി ഉപയോഗിക്കുന്നു. പൊതു രേഖകളിൽ വ്യക്തിവിവരങ്ങൾ പ്രസിദ്ധീകരിക്കില്ല.',
  },
};
