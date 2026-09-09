import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@paradigma/ui/styles.css';
import App from './App';
import { AuthGate } from './Auth';
createRoot(document.getElementById('root')!).render(<StrictMode><AuthGate><App /></AuthGate></StrictMode>);
