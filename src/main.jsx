import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import DesktopApp from "./App.jsx";
import MobileApp from "./MobileApp.jsx";
import { AppProvider, useStore } from "./store.jsx";
import "./index.css";

function Root() {
  const [width, setWidth] = useState(window.innerWidth);
  const store = useStore();

  // Window resize handler to switch layouts dynamically
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!store.loaded) {
    const savedTheme = localStorage.getItem('todo-proto-theme') || 'light';
    return (
      <div style={{
        display: 'grid', placeItems: 'center', height: '100dvh', width: '100vw',
        background: savedTheme === 'dark' ? '#141416' : '#f7f6f4', color: savedTheme === 'dark' ? '#ededee' : '#25241f',
        fontSize: 16, fontWeight: 800, fontFamily: 'sans-serif'
      }}>
        Loading Casex Tasks...
      </div>
    );
  }

  return (
    <AppProvider value={store}>
      <div className="app-root" data-theme={store.theme} style={{ width: '100vw', overflow: 'hidden' }}>
        {width < 768 ? (
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
