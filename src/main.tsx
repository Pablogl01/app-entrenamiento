import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/type.css'
import './styles/ui.css'
import './styles/screens.css'
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
