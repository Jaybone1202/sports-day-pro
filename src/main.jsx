import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Notice the '!' is gone from getElementById('root')
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)