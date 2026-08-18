import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { useAuthStore } from '@common/stores/authStore';

const rootElement = document.getElementById('root')!;
document.documentElement.style.height = '100%';
document.body.style.margin = '0';
document.body.style.height = '100%';
rootElement.style.height = '100%';

useAuthStore.getState().initialize().then(() => {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter basename="/sample">
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
});
