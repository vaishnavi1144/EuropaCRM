import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AppContextProvider } from '@/context/AppContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContextProvider>
        <App />
      </AppContextProvider>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  </React.StrictMode>,
);
