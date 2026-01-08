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

contextBridge.exposeInMainWorld("electronAPI", {
  getTailwindCss: () => tailwindCss,
  // Register a callback to be called when sidebar-toggle IPC is received
  // This is the v1.4.0 pattern - directly pass callback to ipcRenderer.on
  // The callback is proxied through contextBridge and invoked when IPC arrives
  onSidebarToggle: (callback: () => void) => {
    console.log("[Preload] onSidebarToggle: Registering IPC listener for sidebar-toggle");
    ipcRenderer.on("sidebar-toggle", (_event) => {
      console.log("[Preload] sidebar-toggle IPC received, invoking callback...");
      callback();
    });
    console.log("[Preload] onSidebarToggle: IPC listener registered successfully");
  },
  saveConfig: (config: Partial<Config>) =>
    ipcRenderer.send("save-config", config),
  getCurrentConfig: () => ipcRenderer.invoke("get-config"),
  onConfigLoaded: (callback: (config: Config) => void) => {
    ipcRenderer.on("config-loaded", (_event, config) => callback(config));
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
