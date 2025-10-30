
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import DataConnectProvider from './components/DataConnect';
import './style.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DataConnectProvider>
      <App />
    </DataConnectProvider>
  </React.StrictMode>
);
