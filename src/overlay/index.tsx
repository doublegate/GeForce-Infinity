import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./components/sidebar";
import type { Config } from "../shared/types";
import { defaultConfig } from "../shared/types";
import { UserProvider } from "./contexts/UserContext";

let css = "";
try {
  css = window.electronAPI?.getTailwindCss() || "";
} catch (error) {
  console.error("Failed to get Tailwind CSS:", error);
}

if (css) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

const mount = document.createElement("div");
mount.id = "geforce-infinity-sidebar-root";
document.body.appendChild(mount);

const App = () => {
  const [visible, setVisible] = React.useState(false);
  const [config, setConfig] = useState<Config>(defaultConfig);

  useEffect(() => {
    console.log("[Overlay] useEffect running - setting up sidebar toggle handlers");
    console.log("[Overlay] window.electronAPI available:", !!window.electronAPI);

    if (window.electronAPI) {
      // Load initial config
      window.electronAPI
        .getCurrentConfig()
        .then((config) => {
          console.log("[Overlay] Initial config loaded:", config);
          setConfig(config);
        })
        .catch((error) => {
          console.error("[Overlay] Failed to get current config:", error);
        });

      // Listen for config changes
      window.electronAPI.onConfigLoaded((config: Config) => {
        console.log("[Overlay] Config updated from main process:", config);
        setConfig(config);
      });

      // Register callback for sidebar toggle from main process (via globalShortcut)
      // This is the proper contextBridge pattern - callbacks can be passed through
      // and Electron creates a proxy that allows cross-context invocation
      console.log("[Overlay] Registering sidebar toggle callback via electronAPI...");
      window.electronAPI.onSidebarToggle(() => {
        console.log("[Overlay] Sidebar toggle callback invoked! Toggling visibility...");
        setVisible((v) => {
          console.log("[Overlay] Visibility changing from", v, "to", !v);
          return !v;
        });
      });
      console.log("[Overlay] Sidebar toggle callback registered successfully");
    } else {
      console.warn("[Overlay] electronAPI not available, using default config");
    }

    // Fallback keyboard handler - this catches Ctrl+I when:
    // 1. globalShortcut fails to register (another app has it)
    // 2. The user is focused on an element that receives keyboard events
    // Note: With globalShortcut registered, Ctrl+I is intercepted at system level
    // so this handler mainly serves as a fallback
    console.log("[Overlay] Registering fallback keyboard handler for Ctrl+I...");
    const keyboardHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "i") {
        console.log("[Overlay] Ctrl+I detected via keyboard handler! Toggling visibility...");
        e.preventDefault();
        setVisible((v) => {
          console.log("[Overlay] Visibility changing from", v, "to", !v);
          return !v;
        });
      }
    };

    window.addEventListener("keydown", keyboardHandler);
    console.log("[Overlay] Keyboard handler registered on window");

    // Cleanup function
    return () => {
      window.removeEventListener("keydown", keyboardHandler);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.saveConfig(config);
    }
  }, [config]);

  return (
    <UserProvider>
      <Sidebar config={config} setConfig={setConfig} visible={visible} />
    </UserProvider>
  );
};

createRoot(mount).render(<App />);
