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
        if (window.electronAPI) {
            window.electronAPI.getCurrentConfig().then((config) => {
                setConfig(config);
            }).catch((error) => {
                console.error("Failed to get current config:", error);
            });

            window.electronAPI.onConfigLoaded((config: Config) => {
                console.log("Config loaded in overlay:", config);
                setConfig(config);
            });

            // Primary: IPC-based sidebar toggle from main process via before-input-event
            // This intercepts Ctrl+I at the main process level, before any iframe can
            // consume the keyboard event. See docs/SIDEBAR-TOGGLE-DESIGN.md for details.
            window.electronAPI.onSidebarToggle(() => {
                console.log("[Overlay] Sidebar toggle received via IPC");
                setVisible((v) => !v);
            });
        } else {
            console.warn("electronAPI not available, using default config");
        }

        // Fallback: DOM event handler for direct overlay interactions
        // This is kept as a backup in case IPC doesn't work in some edge cases
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "i") {
                e.preventDefault();
                setVisible((v) => !v);
            }
        };

        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
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
