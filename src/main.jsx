import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import DesktopApp from "./App.jsx";
import MobileApp from "./MobileApp.jsx";
import { AppProvider, useStore } from "./store.jsx";
import "./index.css";

function Root() {
  const LS = 'todo-proto-prefs';
  const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const prefs = loadPrefs();

  const [theme, setTheme] = useState(prefs.theme || 'light');
  const [width, setWidth] = useState(window.innerWidth);
  const store = useStore();

  useEffect(() => {
    localStorage.setItem(LS, JSON.stringify({ ...loadPrefs(), theme }));
  }, [theme]);

  // Window resize handler to switch layouts dynamically
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  if (!store.loaded) {
    return (
      <div style={{
        display: 'grid', placeItems: 'center', height: '100vh', width: '100vw',
        background: theme === 'dark' ? '#141416' : '#f7f6f4', color: theme === 'dark' ? '#ededee' : '#25241f',
        fontSize: 16, fontWeight: 800, fontFamily: 'sans-serif'
      }}>
        Loading Casex Tasks...
      </div>
    );
  }

  return (
    <AppProvider value={store}>
      <div className="app-root" data-theme={theme} style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {width < 768 ? (
          <MobileApp density="card" theme={theme} onToggleTheme={toggleTheme} />
        ) : (
          <DesktopApp density="card" theme={theme} onToggleTheme={toggleTheme} frameW={width} />
        )}
      </div>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")).render(<Root />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath)
      .then((reg) => console.log('SW registered:', reg))
      .catch((err) => console.error('SW registration failed:', err));
  });
}
