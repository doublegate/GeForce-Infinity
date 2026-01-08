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
    } else {
      console.warn("[Overlay] electronAPI not available, using default config");
    }

    // PRIMARY: Listen for CustomEvent dispatched by main process via executeJavaScript
    // This is the definitive fix for Ctrl+I toggle (v1.5.6+)
    // The main process's globalShortcut handler dispatches this event directly into the renderer
    // This bypasses all contextBridge/IPC callback issues that plagued v1.5.1-v1.5.5
    console.log(
      "[Overlay] Registering PRIMARY handler: geforce-sidebar-toggle CustomEvent...",
    );
    const customEventHandler = () => {
      console.log(
        "[Overlay] geforce-sidebar-toggle CustomEvent received! Toggling visibility...",
      );
      setVisible((v) => {
        console.log("[Overlay] Visibility changing from", v, "to", !v);
        return !v;
      });
    };
    document.addEventListener("geforce-sidebar-toggle", customEventHandler);
    console.log("[Overlay] CustomEvent handler registered on document");

    // FALLBACK: Keyboard handler for when globalShortcut fails to register
    // This catches Ctrl+I when another app has the shortcut registered
    // Note: When globalShortcut succeeds, Ctrl+I is intercepted at OS level
    // and this handler won't fire (the CustomEvent handler above will)
    console.log(
      "[Overlay] Registering FALLBACK handler: keyboard Ctrl+I...",
    );
    const keyboardHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "i") {
        console.log(
          "[Overlay] Ctrl+I detected via keyboard handler (fallback)! Toggling visibility...",
        );
        e.preventDefault();
        setVisible((v) => {
          console.log("[Overlay] Visibility changing from", v, "to", !v);
          return !v;
        });
      }
    };
    window.addEventListener("keydown", keyboardHandler);
    console.log("[Overlay] Keyboard handler registered on window");

    // Cleanup function - remove both listeners
    return () => {
      document.removeEventListener("geforce-sidebar-toggle", customEventHandler);
      window.removeEventListener("keydown", keyboardHandler);
      console.log("[Overlay] Cleaned up sidebar toggle handlers");
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
