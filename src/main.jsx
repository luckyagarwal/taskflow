import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import DesktopApp from "./App.jsx";
import MobileApp from "./MobileApp.jsx";
import { AppProvider, useStore } from "./store.jsx";
import "./index.css";

function Root() {
  const [width, setWidth] = useState(window.innerWidth);
  const [pathname, setPathname] = useState(() => typeof window !== 'undefined' ? window.location.pathname : '/');
  const store = useStore();

  // Window resize handler for desktop reflow
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Path routing handler
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!store.loaded || store.wipingDb) {
    const savedTheme = localStorage.getItem('todo-proto-theme') || 'light';
    return (
      <div style={{
        display: 'grid', placeItems: 'center', height: '100dvh', width: '100vw',
        background: savedTheme === 'dark' ? '#141416' : '#FAF9F6', 
        color: savedTheme === 'dark' ? '#ECECED' : '#1E1E1C',
        fontFamily: "'Nunito', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif"
      }}>
        <div className="pulse-loader">
          <div className="spinner" />
          <div className="pulse-loader-text">
            {store.wipingDb ? "Resetting Database..." : "Loading Tasks..."}
          </div>
        </div>
      </div>
    );
  }

  const isMobile = pathname.startsWith('/mobile');

  return (
    <AppProvider value={store}>
      <div className="app-root" data-theme={store.theme} style={{ width: '100vw', overflow: 'hidden' }}>
        {isMobile ? (
          <MobileApp />
        ) : (
          <DesktopApp frameW={width} />
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
