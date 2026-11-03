import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App, { ErrorBoundary } from './App.jsx'

// Prevent scroll wheel from changing number input values
document.addEventListener('wheel', (e) => {
  if (document.activeElement?.type === 'number') document.activeElement.blur();
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary context="application">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
