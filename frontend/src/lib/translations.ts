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

  // Complaint form
  formEyebrow: { en: 'ONE SIMPLE FORM', ml: 'ഒറ്റ ലളിതമായ ഫോം' },
  formHeading: { en: 'Tell us what happened.', ml: 'എന്താണ് സംഭവിച്ചതെന്ന് പറയൂ.' },
  formSubheading: {
    en: 'Add the details you have. A ticket photo and your voice can fill the form for you.',
    ml: 'നിങ്ങളുടെ കൈവശമുള്ള വിവരങ്ങൾ നൽകൂ. ടിക്കറ്റ് ചിത്രവും നിങ്ങളുടെ ശബ്ദവും ഫോം സ്വയം പൂരിപ്പിക്കാൻ സഹായിക്കും.',
  },
  formProblemLabel: { en: 'YOUR REPORT', ml: 'നിങ്ങളുടെ പരാതി' },
  formProblemHeading: { en: 'Describe the problem', ml: 'പ്രശ്നം വിവരിക്കുക' },
  formDescriptionPlaceholder: {
    en: 'Tell us what happened in your own words...',
    ml: 'എന്താണ് സംഭവിച്ചതെന്ന് നിങ്ങളുടെ വാക്കുകളിൽ എഴുതൂ...',
  },
  formSpeak: { en: 'Speak', ml: 'സംസാരിക്കുക' },
  formHideVoice: { en: 'Hide voice input', ml: 'ശബ്ദ ഇൻപുട്ട് അടയ്ക്കുക' },
  formCategoryLabel: { en: 'CLASSIFICATION', ml: 'വിഭാഗം' },
  formChangeCategory: { en: 'Change category', ml: 'വിഭാഗം മാറ്റുക' },
  formHideCategories: { en: 'Hide categories', ml: 'വിഭാഗങ്ങൾ അടയ്ക്കുക' },
  formTicketLabel: { en: 'OPTIONAL TICKET', ml: 'ഓപ്ഷണൽ ടിക്കറ്റ്' },
  formTicketHeading: { en: 'Let us read your ticket', ml: 'നിങ്ങളുടെ ടിക്കറ്റ് വായിക്കാം' },
  formTicketSubheading: {
    en: 'Upload a ticket image and we will extract the bus, route and date into the fields below.',
    ml: 'ടിക്കറ്റ് ചിത്രം അപ്‌ലോഡ് ചെയ്യൂ. ബസ്, റൂട്ട്, തീയതി എന്നിവ താഴെയുള്ള ഫീൽഡുകളിൽ സ്വയം പൂരിപ്പിക്കും.',
  },
  formUploadTicket: { en: 'Upload ticket photo', ml: 'ടിക്കറ്റ് ചിത്രം അപ്‌ലോഡ് ചെയ്യുക' },
  formReadingTicket: { en: 'Reading ticket...', ml: 'ടിക്കറ്റ് വായിക്കുന്നു...' },
  formExtracting: { en: 'Extracting details', ml: 'വിവരങ്ങൾ വേർതിരിക്കുന്നു' },
  formTicketRead: { en: 'Ticket read. Autofilled fields:', ml: 'ടിക്കറ്റ് വായിച്ചു. പൂരിപ്പിച്ച ഫീൽഡുകൾ:' },
  formTicketFailed: { en: 'We could not read that image. You can fill the fields manually.', ml: 'ചിത്രം വായിക്കാനായില്ല. വിവരങ്ങൾ സ്വയം പൂരിപ്പിക്കാം.' },
  formTicketUnavailable: { en: 'Ticket reading is unavailable. You can fill the fields manually.', ml: 'ടിക്കറ്റ് വായന ഇപ്പോൾ ലഭ്യമല്ല. വിവരങ്ങൾ സ്വയം പൂരിപ്പിക്കാം.' },
  formJourneyLabel: { en: 'JOURNEY', ml: 'യാത്ര' },
  formJourneyHeading: { en: 'Where did it happen?', ml: 'എവിടെയാണ് സംഭവിച്ചത്?' },
  formFrom: { en: 'From', ml: 'ആരംഭം' },
  formTo: { en: 'To', ml: 'ലക്ഷ്യം' },
  formVia: { en: 'Via (optional)', ml: 'വഴി (ഓപ്ഷണൽ)' },
  formBusNumber: { en: 'Bus or registration number', ml: 'ബസ് അല്ലെങ്കിൽ രജിസ്ട്രേഷൻ നമ്പർ' },
  formLocation: { en: 'Specific location (optional)', ml: 'കൃത്യമായ സ്ഥലം (ഓപ്ഷണൽ)' },
  formFromPlaceholder: { en: 'Starting stop', ml: 'ആരംഭ സ്റ്റോപ്പ്' },
  formToPlaceholder: { en: 'Destination stop', ml: 'ലക്ഷ്യ സ്റ്റോപ്പ്' },
  formOptionalPlaceholder: { en: 'If you know it', ml: 'അറിയാമെങ്കിൽ' },
  formBusPlaceholder: { en: 'For example, KL-15-A-4892', ml: 'ഉദാഹരണം, KL-15-A-4892' },
  formLocationPlaceholder: { en: 'For example, rear seats', ml: 'ഉദാഹരണം, പിന്നിലെ സീറ്റുകൾ' },
  formEvidenceLabel: { en: 'EVIDENCE', ml: 'തെളിവ്' },
  formEvidenceHeading: { en: 'Add supporting files', ml: 'പിന്തുണയ്ക്കുന്ന ഫയലുകൾ ചേർക്കുക' },
  formAddEvidence: { en: 'Add photo or file', ml: 'ചിത്രം അല്ലെങ്കിൽ ഫയൽ ചേർക്കുക' },
  formUploading: { en: 'Uploading...', ml: 'അപ്‌ലോഡ് ചെയ്യുന്നു...' },
  formRemove: { en: 'Remove', ml: 'നീക്കം ചെയ്യുക' },
  formContactLabel: { en: 'FOLLOW-UP', ml: 'തുടർനടപടി' },
  formContactHeading: { en: 'How can we reach you?', ml: 'എങ്ങനെ ബന്ധപ്പെടണം?' },
  formPhone: { en: 'Mobile number (optional)', ml: 'മൊബൈൽ നമ്പർ (ഓപ്ഷണൽ)' },
  formPhonePlaceholder: { en: '10-digit mobile number', ml: '10 അക്ക മൊബൈൽ നമ്പർ' },
  formContactChannel: { en: 'Preferred updates channel', ml: 'അറിയിപ്പുകൾ ലഭിക്കേണ്ട വഴി' },
  formWhatsapp: { en: 'WhatsApp (recommended)', ml: 'വാട്ട്സ്ആപ്പ് (ശുപാർശ ചെയ്യുന്നു)' },
  formSms: { en: 'SMS', ml: 'എസ്എംഎസ്' },
  formEmail: { en: 'Email', ml: 'ഇമെയിൽ' },
  formPrivacy: { en: 'Your details are used only for complaint resolution.', ml: 'നിങ്ങളുടെ വിവരങ്ങൾ പരാതി പരിഹാരത്തിനായി മാത്രം ഉപയോഗിക്കും.' },
  formSubmitting: { en: 'Submitting...', ml: 'സമർപ്പിക്കുന്നു...' },
  formDescriptionRequired: { en: 'Please describe what happened.', ml: 'എന്താണ് സംഭവിച്ചതെന്ന് വിവരിക്കുക.' },
  formRouteRequired: { en: 'Please provide both the starting point and destination.', ml: 'ആരംഭ സ്ഥലവും ലക്ഷ്യസ്ഥാനവും നൽകുക.' },
  formUploadError: { en: 'This file could not be uploaded. Please try again.', ml: 'ഈ ഫയൽ അപ്‌ലോഡ് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.' },
  formSubmitError: { en: 'We could not submit your complaint right now. Your details are still here.', ml: 'ഇപ്പോൾ പരാതി സമർപ്പിക്കാനായില്ല. നിങ്ങളുടെ വിവരങ്ങൾ ഇവിടെ സുരക്ഷിതമാണ്.' },
  voiceStatusActive: { en: 'Speech recognition active', ml: 'ശബ്ദ തിരിച്ചറിയൽ സജീവമാണ്' },
  voiceSpoken: { en: 'Spoken language:', ml: 'സംസാരിക്കുന്ന ഭാഷ:' },
  voiceAutoDetect: { en: 'Auto detect', ml: 'സ്വയം കണ്ടെത്തുക' },
  voiceRecordHeading: { en: 'Record your complaint', ml: 'നിങ്ങളുടെ പരാതി റെക്കോർഡ് ചെയ്യുക' },
  voiceRecordInstruction: { en: 'Tap the mic, speak naturally about your trip and grievance, then tap stop.', ml: 'മൈക്ക് അമർത്തി യാത്രയും പരാതിയും സ്വാഭാവികമായി പറയുക, തുടർന്ന് നിർത്തുക.' },
  voiceStopRecording: { en: 'Stop recording', ml: 'റെക്കോർഡിംഗ് നിർത്തുക' },
  voiceStartRecording: { en: 'Start recording', ml: 'റെക്കോർഡിംഗ് ആരംഭിക്കുക' },
  voiceRecording: { en: 'Recording', ml: 'റെക്കോർഡ് ചെയ്യുന്നു' },
  voiceTapStop: { en: 'Tap the square when you are finished speaking', ml: 'സംസാരം പൂർത്തിയായാൽ ചതുരം അമർത്തുക' },
  voiceTranscribing: { en: 'Transcribing your voice...', ml: 'നിങ്ങളുടെ ശബ്ദം എഴുത്താക്കുന്നു...' },
  voiceExtracting: { en: 'Finding the route, bus number and complaint category', ml: 'റൂട്ട്, ബസ് നമ്പർ, പരാതി വിഭാഗം കണ്ടെത്തുന്നു' },
  voiceTapMic: { en: 'Tap the mic to start speaking', ml: 'സംസാരിക്കാൻ മൈക്ക് അമർത്തുക' },
  voiceSecure: { en: 'Up to 30 seconds · Audio is processed securely', ml: '30 സെക്കൻഡ് വരെ · ഓഡിയോ സുരക്ഷിതമായി പ്രോസസ്സ് ചെയ്യും' },
  voiceTranscribed: { en: 'Transcribed with speech recognition:', ml: 'ശബ്ദത്തിൽ നിന്ന് എഴുത്താക്കി:' },
  voiceEnglishTranslation: { en: 'English translation:', ml: 'ഇംഗ്ലീഷ് വിവർത്തനം:' },
  voiceSample: { en: 'Sample phrasing:', ml: 'ഉദാഹരണ വാചകം:' },
};
