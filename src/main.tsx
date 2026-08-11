import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AudioPipelineProvider } from '@/context/AudioPipelineContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AudioPipelineProvider>
        <App />
      </AudioPipelineProvider>
    </BrowserRouter>
  </StrictMode>
);
