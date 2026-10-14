import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from './lib/clerk'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import { MALAYALAM_CLERK } from './lib/clerk-localization'

// ponytail: ClerkProvider only when a publishable key exists, so the app
// boots (demo mode) before the keys are pasted in.
function AuthRoot({children}: {children: ReactNode}) {
  const {language} = useLanguage();
  if (!clerkEnabled) return children;
  return <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} localization={language === 'ml' ? MALAYALAM_CLERK : undefined} signInFallbackRedirectUrl="/account" signUpFallbackRedirectUrl="/account">{children}</ClerkProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider><AuthRoot><App /></AuthRoot></LanguageProvider>
  </StrictMode>,
)
