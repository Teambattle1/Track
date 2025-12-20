
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Critical Failure: Root element not found in DOM.");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Application Initialization Error:", error);
  rootElement.innerHTML = `
    <div style="height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px;">
      <div>
        <h1 style="color: #f97316;">Application Error</h1>
        <p>Something went wrong during startup. Please refresh the page.</p>
        <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; font-size: 12px; margin-top: 20px; color: #94a3b8;">${error instanceof Error ? error.message : String(error)}</pre>
      </div>
    </div>
  `;
}
