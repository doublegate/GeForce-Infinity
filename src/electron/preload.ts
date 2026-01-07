import { contextBridge, ipcRenderer, clipboard, shell } from "electron";
import { Config } from "../shared/types.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

declare global {
  interface Window {
    toggleSidebar: () => void;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  console.log(
    "[Preload] DOMContentLoaded fired - will load overlay script in 100ms",
  );
  setTimeout(() => {
    console.log("[Preload] Loading overlay script from app://overlay/index.js");
    try {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "app://overlay/index.js";
      script.onerror = (error) => {
        console.error("[Preload] OVERLAY SCRIPT FAILED TO LOAD:", error);
        // Don't throw error - this is expected if overlay files don't exist
      };
      script.onload = () => {
        console.log("[Preload] Overlay script loaded successfully!");
      };

      // Add additional error handling for script execution
      script.addEventListener("error", (event) => {
        console.log("Overlay script error event:", event);
      });

      // Wrap script append in additional try-catch
      try {
        document.body.appendChild(script);
        console.log("[Preload] Overlay script element appended to body");
      } catch (appendError) {
        console.error("[Preload] Error appending overlay script:", appendError);
      }
    } catch (error) {
      console.error("[Preload] Error creating overlay script:", error);
    }
  }, 100); // Small delay to ensure page is fully ready
});

console.log("[Preload] Preload script initialization complete");

const cssPath = path.join(__dirname, "../assets/tailwind.bundle.css");
let tailwindCss = "";
try {
  tailwindCss = fs.readFileSync(cssPath, "utf-8");
} catch (err) {
  console.error("❌ Failed to read Tailwind CSS:", err);
}

console.log("[Preload] Setting up electronAPI via contextBridge...");

// Set up IPC listener immediately and dispatch CustomEvent to the page
// Using CustomEvent is more reliable than passing callbacks across the contextBridge
// The overlay listens for this event directly on window
console.log("[Preload] Setting up sidebar-toggle IPC listener...");
ipcRenderer.on("sidebar-toggle", () => {
  console.log(
    "[Preload] 'sidebar-toggle' IPC received! Dispatching CustomEvent to page...",
  );
  window.dispatchEvent(new CustomEvent("geforce-infinity-sidebar-toggle"));
  console.log(
    "[Preload] CustomEvent 'geforce-infinity-sidebar-toggle' dispatched",
  );
});

contextBridge.exposeInMainWorld("electronAPI", {
  getTailwindCss: () => tailwindCss,
  // Note: onSidebarToggle is kept for backward compatibility but the overlay now
  // listens directly for the 'geforce-infinity-sidebar-toggle' CustomEvent instead
  onSidebarToggle: (callback: () => void) => {
    console.log(
      "[Preload] onSidebarToggle called (legacy - overlay uses direct CustomEvent listener now)",
    );
    // Legacy callback support - overlay should use direct CustomEvent listener instead
    window.addEventListener("geforce-infinity-sidebar-toggle", callback);
  },
  saveConfig: (config: Partial<Config>) =>
    ipcRenderer.send("save-config", config),
  getCurrentConfig: () => ipcRenderer.invoke("get-config"),
  onConfigLoaded: (callback: (config: Config) => void) => {
    ipcRenderer.on("config-loaded", (event, config) => callback(config));
  },
  reloadGFN: () => {
    ipcRenderer.send("reload-gfn");
  },
  copyToClipboard: (text: string) => clipboard.writeText(text),
  openExternal: (url: string) => shell.openExternal(url),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  quitAndInstall: () => ipcRenderer.send("quit-and-install"),
  updateAvailable: (
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ) => ipcRenderer.on("update-available", callback),
  updateDownloaded: (
    callback: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void,
  ) => ipcRenderer.on("update-downloaded", callback),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
});

// Diagnostics API for codec and GPU information
contextBridge.exposeInMainWorld("diagnostics", {
  // Get full diagnostics report (chrome://gpu style)
  getDiagnosticsReport: () => ipcRenderer.invoke("get-diagnostics-report"),
  // Run comprehensive codec tests
  runCodecTests: () => ipcRenderer.invoke("run-codec-tests"),
  // Get codec capabilities only
  getCodecCapabilities: () => ipcRenderer.invoke("get-codec-capabilities"),
  // Get GPU information only
  getGPUInfo: () => ipcRenderer.invoke("get-gpu-info"),
  // Get platform information only
  getPlatformInfo: () => ipcRenderer.invoke("get-platform-info"),
  // Get quick summary for display
  getDiagnosticsSummary: () => ipcRenderer.invoke("get-diagnostics-summary"),
  // Log diagnostics to console (for debugging)
  logDiagnostics: () => ipcRenderer.invoke("log-diagnostics"),
});
