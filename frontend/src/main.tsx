import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from './lib/clerk'

// ponytail: ClerkProvider only when a publishable key exists, so the app
// boots (demo mode) before the keys are pasted in.
function render(node: ReactNode) {
  if (!clerkEnabled) return node;
  return <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>{node}</ClerkProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {render(<App />)}
  </StrictMode>,
)
