import React from 'react';
import ReactDOM from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import 'konsta/theme.css';
import App from './App';
import './index.css';
import { applyAccentTheme, loadAccentTheme } from './utils/accentTheme';

applyAccentTheme(loadAccentTheme());

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <IconContext.Provider value={{ size: '1em', weight: 'bold', mirrored: false }}>
      <App />
    </IconContext.Provider>
  </React.StrictMode>
);