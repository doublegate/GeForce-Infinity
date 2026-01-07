import * as React from "react";
import { createContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./components/sidebar";
import type { Config } from "../shared/types";
import { defaultConfig } from "../shared/types";
import { User } from "firebase/auth";
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
    console.log(
      "[Overlay] useEffect running - setting up sidebar toggle handlers",
    );
    console.log(
      "[Overlay] window.electronAPI available:",
      !!window.electronAPI,
    );

    if (window.electronAPI) {
      window.electronAPI
        .getCurrentConfig()
        .then((config) => {
          setConfig(config);
        })
        .catch((error) => {
          console.error("Failed to get current config:", error);
        });

      window.electronAPI.onConfigLoaded((config: Config) => {
        console.log("Config loaded in overlay:", config);
        setConfig(config);
      });
    } else {
      console.warn("electronAPI not available, using default config");
    }

    // Direct CustomEvent listener for sidebar toggle from main process
    // This is more reliable than using contextBridge callbacks which can fail silently
    console.log(
      "[Overlay] Registering direct CustomEvent listener for sidebar-toggle...",
    );
    const customEventHandler = () => {
      console.log(
        "[Overlay] CustomEvent 'geforce-infinity-sidebar-toggle' received! Toggling visibility...",
      );
      setVisible((v) => {
        console.log("[Overlay] Visibility changing from", v, "to", !v);
        return !v;
      });
    };
    window.addEventListener(
      "geforce-infinity-sidebar-toggle",
      customEventHandler,
    );
    console.log("[Overlay] Direct CustomEvent listener registered");

    // Fallback keyboard handler for when overlay has focus
    console.log(
      "[Overlay] Registering fallback keyboard handler for Ctrl+I...",
    );
    const keyboardHandler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "i") {
        console.log(
          "[Overlay] Ctrl+I detected via keyboard handler! Toggling visibility...",
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

    // Cleanup function
    return () => {
      window.removeEventListener(
        "geforce-infinity-sidebar-toggle",
        customEventHandler,
      );
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
