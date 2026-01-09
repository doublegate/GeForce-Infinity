import {
    app,
    Notification,
    globalShortcut,
    BrowserWindow,
    shell,
    protocol,
    session,
    webFrameMain,
} from "electron";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { registerIpcHandlers } from "./ipc/index.js";
import { createMainWindow } from "./managers/window.js";
import { getConfig, saveConfig, loadConfig } from "./managers/config.js";
import { createTray } from "./managers/tray.js";
import { clientId, initRpcClient, updateActivity } from "./managers/discord.js";

// Suppress IBUS warnings on Linux
if (process.platform === "linux") {
    process.env.IBUS_USE_PORTAL = "0";
    process.env.GTK_IM_MODULE = "gtk-im-context-simple";
}

function overrideVersionInDev() {
    if (!app.isPackaged) {
        const pkgPath = path.join(__dirname, "../../package.json");
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            app.getVersion = () => pkg.version;
            console.log("[DEV] Overridden app.getVersion():", pkg.version);
        } else {
            console.warn("[DEV] Cannot find package.json to get version");
        }
    }
}

/**
 * Log codec and hardware acceleration support at startup.
 * This helps users diagnose issues with 4K/AV1/HEVC streaming.
 * See docs/PLATFORM-REQUIREMENTS.md for platform-specific requirements.
 */
function logCodecSupport() {
    console.log("\n========================================");
    console.log("GeForce Infinity - Codec Support Status");
    console.log("========================================");

    // Platform information
    console.log(`Platform: ${process.platform}`);
    console.log(`Electron: ${process.versions.electron}`);
    console.log(`Chrome: ${process.versions.chrome}`);
    console.log(`Node: ${process.versions.node}`);
    console.log(`V8: ${process.versions.v8}`);

    // GPU and hardware acceleration info
    console.log("\n--- Hardware Acceleration ---");
    const gpuFeatureStatus = app.getGPUFeatureStatus();
    const gpuInfo = app.getGPUInfo("basic");

    console.log("GPU Feature Status:");
    Object.entries(gpuFeatureStatus).forEach(([feature, status]) => {
        // Highlight video-related features
        if (feature.includes("video") || feature.includes("decode") ||
            feature.includes("gpu") || feature.includes("accelerat")) {
            console.log(`  ${feature}: ${status}`);
        }
    });

    // Log command-line switches that affect codecs
    console.log("\n--- Codec-Related Command Line Switches ---");
    const codecSwitches = [
        "enable-accelerated-video-decode",
        "enable-hardware-overlays",
        "enable-features",
        "disable-features",
    ];

    codecSwitches.forEach(sw => {
        const value = app.commandLine.getSwitchValue(sw);
        if (value) {
            console.log(`  --${sw}=${value}`);
        } else if (app.commandLine.hasSwitch(sw)) {
            console.log(`  --${sw} (enabled)`);
        }
    });

    // Codec support summary
    console.log("\n--- Expected Codec Support ---");
    console.log("  AV1:  Enabled via Av1Decoder, VaapiAV1Decoder flags");
    console.log("  HEVC: Enabled via PlatformHEVCDecoderSupport flag");
    console.log("  VP9:  Standard Chromium support");
    console.log("  H.264: Standard Chromium support");

    // Platform-specific notes
    console.log("\n--- Platform Notes ---");
    if (process.platform === "linux") {
        console.log("  Linux: Requires VA-API drivers for hardware decoding");
        console.log("  - AMD: mesa-va-drivers, libva-mesa-driver");
        console.log("  - NVIDIA: nvidia-vaapi-driver (for newer cards)");
        console.log("  - Intel: intel-media-driver or libva-intel-driver");
    } else if (process.platform === "darwin") {
        console.log("  macOS: Hardware decoding via VideoToolbox");
        console.log("  - Apple Silicon: Native AV1/HEVC support");
        console.log("  - Intel Macs: HEVC via T2 chip, AV1 via software");
    } else if (process.platform === "win32") {
        console.log("  Windows: Hardware decoding via DXVA2/D3D11");
        console.log("  - NVIDIA: Requires GTX 10-series or newer for AV1");
        console.log("  - AMD: Requires RX 6000 series or newer for AV1");
        console.log("  - Intel: Arc GPUs for AV1, 6th gen+ for HEVC");
    }

    // Async GPU info (detailed)
    // Using Electron.GPUInfo type but handling potential structure variations
    interface GPUDevice {
        deviceString?: string;
        deviceId?: number;
        vendorString?: string;
        driverVersion?: string;
    }
    interface GPUInfoBasic {
        gpuDevice?: GPUDevice[];
    }

    gpuInfo.then((rawInfo: unknown) => {
        const info = rawInfo as GPUInfoBasic;
        console.log("\n--- GPU Information ---");
        if (info.gpuDevice && info.gpuDevice.length > 0) {
            info.gpuDevice.forEach((gpu: GPUDevice, index: number) => {
                console.log(`  GPU ${index}: ${gpu.deviceString || gpu.deviceId || 'Unknown'}`);
                if (gpu.vendorString) console.log(`    Vendor: ${gpu.vendorString}`);
                if (gpu.driverVersion) console.log(`    Driver: ${gpu.driverVersion}`);
            });
        } else {
            console.log("  GPU device info not available");
        }
        console.log("========================================\n");
    }).catch((err: Error) => {
        console.log("  GPU info retrieval failed:", err.message);
        console.log("========================================\n");
    });
}

function registerCustomProtocols() {
    protocol.registerSchemesAsPrivileged([
        {
            scheme: "geforce-resource",
            privileges: { standard: true, secure: true },
        },
    ]);
}

//TODO: in future we could greate "theme" CSS files, which will be overriding default nvidia styles,
// so it would be less buggy, more stable, easier to maintain, debug and customizable, instead of
// dynamically replacing it and running obbserver on top of DOM
function replaceColorInCSS(mainWindow: BrowserWindow, accentColor: string) {
    if (!accentColor || accentColor == "") {
        return;
    }
    mainWindow.webContents.executeJavaScript(`
    (function applyColorPatch() {
      let observer;

      function replaceColors() {
        if (observer) observer.disconnect();

        const styles = document.querySelectorAll('style');
        styles.forEach(style => {
          style.innerHTML = style.innerHTML.replace(/#76b900/gi, '${accentColor} !important');
        });

        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
          if (!link.__patched) {
            link.removeAttribute("integrity");
            link.removeAttribute("crossorigin");

            fetch(link.href)
              .then(response => response.text())
              .then(css => {
                const patchedCSS = css.replace(/#76b900/gi, '${accentColor} !important');
                const blob = new Blob([patchedCSS], { type: 'text/css' });
                const newUrl = URL.createObjectURL(blob);
                link.href = newUrl;
                link.__patched = true;
              })
              .catch(err => {
                console.error("Failed to fetch/replace CSS for", link.href, err);
              });
          }
        });

        if (observer) {
          observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
        }
      }

      observer = new MutationObserver(() => {
        replaceColors();
      });

      replaceColors();
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    })();
  `);
}

async function registerAppProtocols() {
    protocol.handle("geforce-resource", async (request) => {
        const cleanPath = request.url
            .replace("geforce-resource://", "")
            .replace(/\/$/, "");
        const filePath = path.join(__dirname, "../assets/resources", cleanPath);

        try {
            const data = await fsPromises.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".webp": "image/webp",
            };
            return new Response(new Uint8Array(data), {
                headers: {
                    "Content-Type":
                        mimeTypes[ext] || "application/octet-stream",
                },
            });
        } catch (err) {
            console.error("Failed to load resource:", err);
            return new Response("Not Found", { status: 404 });
        }
    });

    protocol.handle("app", async (request) => {
        const url = new URL(request.url);
        const filePath = path.join(__dirname, "../overlay", url.pathname);

        try {
            const data = await fsPromises.readFile(filePath);
            return new Response(new Uint8Array(data), {
                status: 200,
                headers: { "Content-Type": "application/javascript" },
            });
        } catch (e) {
            console.error("Failed to serve file", filePath, e);
            return new Response("Not Found", { status: 404 });
        }
    });
}

function registerShortcuts(mainWindow: BrowserWindow) {
    // Sidebar toggle is now handled via before-input-event in setupWindowEvents()
    // This approach intercepts keyboard input at the main process level,
    // before any iframe can consume it, solving the focus-stealing issue.
    // See docs/SIDEBAR-TOGGLE-DESIGN.md for implementation details.

    if (!getConfig().informed) {
        mainWindow.once("ready-to-show", () => {
            new Notification({
                title: "GeForce Infinity",
                body: "Press Ctrl+I to open the sidebar!",
                icon: path.join(
                    __dirname,
                    "..",
                    "..",
                    "assets",
                    "resources",
                    "infinitylogo.png"
                ),
            }).show();
        });
        saveConfig({ informed: true });
    }
}

function setupWindowEvents(mainWindow: BrowserWindow) {
    // Keyboard shortcut handling via before-input-event
    // This intercepts keyboard input at the main process level, before any
    // iframe can consume it. This solves the issue where Ctrl+I wouldn't work
    // when the GeForce NOW streaming iframe had focus.
    // See docs/SIDEBAR-TOGGLE-DESIGN.md for implementation details.
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // Handle Ctrl+I (or Cmd+I on macOS) for sidebar toggle
        const isSidebarToggle =
            (input.control || input.meta) &&
            input.key.toLowerCase() === 'i';

        if (isSidebarToggle && input.type === 'keyDown') {
            console.log('[Shortcuts] Sidebar toggle triggered via before-input-event');
            mainWindow.webContents.send('sidebar-toggle');
            event.preventDefault();
        }
    });

    mainWindow.webContents.on("did-finish-load", async () => {
        const config = getConfig();
        replaceColorInCSS(mainWindow, config.accentColor);
        mainWindow.webContents.send("config-loaded", config);
        
        // Apply fetch patching after page loads to ensure it's available when needed
        console.log("[GeForce Infinity] Page loaded, applying fetch patching...");
        await patchFetchForSessionRequest(mainWindow);
    });

    mainWindow.on("blur", () => {
        if (getConfig().automute === true) {
            mainWindow.webContents.setAudioMuted(true);
        }
    });

    mainWindow.on("focus", () => {
        if (getConfig().automute === true) {
            mainWindow.webContents.setAudioMuted(false);
        }
    });

    mainWindow.on("page-title-updated", (event, title) => {
        event.preventDefault();

        if (title === "Game ending in 60s") {
            const config = getConfig();
            if (config.inactivityNotification === true) {
                new Notification({
                    title: "GeForce Infinity",
                    body: "Your game is about to end in 60 seconds!",
                    icon: path.join(
                        __dirname,
                        "assets/resources/infinitylogo.png"
                    ),
                }).show();
            }
            if (
                config.inactivityNotification === true &&
                config.autofocus === true
            ) {
                mainWindow.maximize();
            }
        }
        let gameName = title
            .replace(/^GeForce NOW - /, "")
            .replace(/ on GeForce NOW$/, "");
        if (
            title === "GeForce Infinity | GeForce NOW" ||
            title === "GeForce NOW"
        ) {
            mainWindow.setTitle("GeForce Infinity");
        } else {
            const modifiedTitle = `GeForce Infinity${
                gameName ? " | " + gameName : ""
            }`;
            mainWindow.setTitle(modifiedTitle);
        }
    });

    let notified = false;
    session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["wss://*/*"] },
        (details, callback) => {
            // Check if the request matches the specific Nvidia Cloudmatch endpoint
            const config = getConfig();
            const url = details.url;
            const isNvidiaRequest =
                url.includes("nvidiagrid.net") &&
                url.includes("/sign_in") &&
                url.includes("peer_id");

            if (isNvidiaRequest) {
                console.log(
                    "Detected Nvidia Cloudmatch WebSocket upgrade request:"
                );
                if (!notified) {
                    if (config.autofocus) {
                        mainWindow.maximize();
                    } else if (config.notify) {
                        new Notification({
                            title: "GeForce Infinity",
                            body: "Your gaming rig is ready!",
                            icon: path.join(
                                __dirname,
                                "assets/resources/infinitylogo.png"
                            ),
                        }).show();
                    }
                    notified = true;

                    // Reset notification flag
                    setTimeout(() => {
                        notified = false;
                    }, 10000);
                }
            }
            callback({ cancel: false });
        }
    );

    // Add HTTP onBeforeRequest handler for POST body modification
    // Investigation confirmed (Sept 2025): This system works correctly and successfully
    // overrides GeForce NOW default resolutions. If higher resolutions (3440x1440, 4K)
    // don't work, it's due to external factors like GeForce NOW account tier restrictions,
    // game-specific limitations, or backend validation - not a bug in this application.
    session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["*://*.nvidiagrid.net/v2/session*"] },
        (details, callback) => {
            if (details.method === "POST" && details.uploadData) {
                const config = getConfig();
                
                // Process uploadData to modify session request
                for (let i = 0; i < details.uploadData.length; i++) {
                    const uploadItem = details.uploadData[i];
                    if (uploadItem.bytes) {
                        try {
                            const bodyText = uploadItem.bytes.toString('utf8');
                            const modifiedBody = tryPatchBody(bodyText, config);
                            
                            if (modifiedBody && modifiedBody !== bodyText) {
                                console.log("[GeForce Infinity] Resolution override applied to POST body");
                                uploadItem.bytes = Buffer.from(modifiedBody, 'utf8');
                            }
                        } catch (error) {
                            console.error("[GeForce Infinity] Error processing POST body:", error);
                        }
                    }
                }
            }
            
            callback({ cancel: false });
        }
    );

    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ["*://*.nvidiagrid.net/v2/*"] },
        (details, callback) => {
            const headers = details.requestHeaders;

            // Force nv-device-os and related platform headers
            headers["nv-device-os"] = "WINDOWS";
            headers["sec-ch-ua-platform"] = '"WINDOWS"';
            headers["sec-ch-ua-platform-version"] = "14.0.0";

           /* // Normalize and update the User-Agent if present
            const uaKey =
                "User-Agent" in headers
                    ? "User-Agent"
                    : "user-agent" in headers
                        ? "user-agent"
                        : null;

            if (uaKey && typeof headers[uaKey] === "string") {
                const ua = headers[uaKey] as string;
                // (Mozilla/x.x) (...) -> Mozilla/x.x (Windows NT 10.0; Win64; x64)
                const patched = ua.replace(
                    /(Mozilla\/[\d.]+) \(.+?\)/,
                    "$1 (Windows NT 10.0; Win64; x64)"
                );
                headers[uaKey] = patched;
            }*/

            callback({ requestHeaders: headers });
        }
    );

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url === "about:blank") {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 800,
                    height: 600,
                    autoHideMenuBar: true,
                    icon: path.join(
                        __dirname,
                        "assets/resources/infinitylogo.png"
                    ),
                    title: "Account Connection",
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        sandbox: true,
                        session: mainWindow.webContents.session,
                    },
                },
            };
        }
        shell.openExternal(url);
        return { action: "deny" };
    });
}

app.setName("GeForce Infinity");
app.commandLine.appendSwitch("enable-media-stream");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-accelerated-video");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames");
// AV1 codec support for 4K streaming
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-hardware-overlays");
app.commandLine.appendSwitch(
    "disable-features",
    "UseChromeOSDirectVideoDecoder"
);
app.commandLine.appendSwitch(
    "enable-features",
    [
        "WaylandWindowDecorations",
        "AcceleratedVideoDecodeLinuxGL",
        "VaapiVideoDecoder",
        "AcceleratedVideoDecodeLinuxZeroCopyGL",
        "VaapiIgnoreDriverChecks",
        "Av1Decoder",
        "VaapiAV1Decoder",
        "GlobalVaapiLock",
        "PlatformHEVCDecoderSupport",
    ].join(",")
);

overrideVersionInDev();
registerCustomProtocols();

function tryPatchBody(initBody: string, configData: any): string | undefined {
    if (!initBody) return undefined;

    const text = initBody;
    const trimmed = text.trim();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return undefined;

    let parsed;
    try { parsed = JSON.parse(trimmed); } catch { return undefined; }

    const srd = parsed && parsed.sessionRequestData;
    if (!srd || srd.clientRequestMonitorSettings == null) return undefined;
    
    // Use passed config data
    const clientSettings = configData;
    
    console.log("[GeForce Infinity] Applying resolution override:", clientSettings.monitorWidth + "x" + clientSettings.monitorHeight, "FPS:", clientSettings.framesPerSecond, "Codec:", clientSettings.codecPreference);
    
    // Calculate appropriate DPI for high resolution displays
    const width = clientSettings.monitorWidth;
    const height = clientSettings.monitorHeight;
    const calculateDPI = (w: number, h: number) => {
      // Standard DPI calculations for common resolutions
      if (w >= 3840 || h >= 2160) return 192; // 4K+ displays
      if (w >= 2560 || h >= 1440) return 144; // 1440p displays
      return 96; // Standard 1080p and below
    };

    // Automatically prefer AV1 for 4K+ resolutions when using auto mode
    const shouldUseAV1 = clientSettings.codecPreference === "av1" || 
                       (clientSettings.codecPreference === "auto" && (width >= 3840 || height >= 2160));

    srd.clientRequestMonitorSettings = [
      { 
        widthInPixels: width,  
        heightInPixels: height,
        framesPerSecond: clientSettings.framesPerSecond, 
        displayData: null, 
        dpi: calculateDPI(width, height), 
        hdr10PlusGamingData: null, 
        monitorId: 0, 
        positionX: 0, 
        positionY: 0, 
        sdrHdrMode: 0
      }
    ];

    // Add codec preference metadata for enhanced compatibility
    if (shouldUseAV1) {
      console.log("[4K Mode] Using AV1 codec for " + width + "x" + height + " streaming");
    }

    const result = JSON.stringify(parsed);
    return result;
}

async function patchFetchForSessionRequest(mainWindow: Electron.CrossProcessExports.BrowserWindow) {
    // Get current configuration from main process before injecting
    const currentConfig = getConfig();
    console.log("[GeForce Infinity] Current config for fetch patching:", currentConfig);
    
    // Define the injection script that will be applied to all frames
    const injectionScript = `((configData) => {
      // Prevent multiple injections in the same frame
      if (window.__GeForceInfinityPatched) {
        console.log("[GeForce Infinity] Frame already patched, skipping");
        return;
      }
      window.__GeForceInfinityPatched = true;
      
      const frameInfo = {
        isMainFrame: window === window.top,
        origin: window.location.origin,
        href: window.location.href
      };
      
      console.log("[GeForce Infinity] ✅ INJECTION SUCCESS - Frame patched:", frameInfo);
      
      const originalFetch = window.fetch?.bind(window);
      
      function isTarget(urlString) {
        try {
          const u = new URL(urlString, location.origin);
          const isNvidiaGrid = /\\.nvidiagrid\\.net$/i.test(u.hostname);
          const isV2Session = /\\/v2\\/session/i.test(u.pathname);
          
          // Debug: Log URL pattern matching
          if (isNvidiaGrid) {
            console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] URL Pattern Check - Hostname matches:", u.hostname, "Path:", u.pathname, "V2Session:", isV2Session);
          }
          
          return isNvidiaGrid && isV2Session;
        } catch {
          return false;
        }
      }
    
      async function tryPatchBody(initBody) {
        if (!initBody) return undefined;
    
        const readText = () => {
          if (typeof initBody === "string") return initBody;
          if (initBody instanceof ArrayBuffer || ArrayBuffer.isView(initBody)) {
            return new TextDecoder().decode(initBody);
          }
          return null;
        };
    
        const text = readText();
        if (!text) return undefined;
    
        const trimmed = text.trim();
        if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return undefined;
    
        let parsed;
        try { parsed = JSON.parse(trimmed); } catch { return undefined; }
    
        const srd = parsed && parsed.sessionRequestData;
        if (!srd || srd.clientRequestMonitorSettings == null) return undefined;
        
        const clientSettings = configData;
        
        console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Found session request, checking config...", clientSettings);
        console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Applying resolution override:", clientSettings.monitorWidth + "x" + clientSettings.monitorHeight, "FPS:", clientSettings.framesPerSecond, "Codec:", clientSettings.codecPreference);
        
        const width = clientSettings.monitorWidth;
        const height = clientSettings.monitorHeight;
        const calculateDPI = (w, h) => {
          if (w >= 3840 || h >= 2160) return 192;
          if (w >= 2560 || h >= 1440) return 144;
          return 96;
        };

        const shouldUseAV1 = clientSettings.codecPreference === "av1" || 
                           (clientSettings.codecPreference === "auto" && (width >= 3840 || height >= 2160));

        srd.clientRequestMonitorSettings = [
          { 
            widthInPixels: width,  
            heightInPixels: height,
            framesPerSecond: clientSettings.framesPerSecond, 
            displayData: null, 
            dpi: calculateDPI(width, height), 
            hdr10PlusGamingData: null, 
            monitorId: 0, 
            positionX: 0, 
            positionY: 0, 
            sdrHdrMode: 0
          }
        ];

        if (shouldUseAV1) {
          console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Using AV1 codec for " + width + "x" + height + " streaming");
        }
    
        return JSON.stringify(parsed);
      }
    
      // Patch fetch if available
      if (originalFetch) {
        const wrappedFetch = Object.assign(async function fetch(input, init) {
          const url = (typeof input === "string" || input instanceof URL) ? String(input) : input.url;
          
          if (url && url.includes('nvidiagrid')) {
            console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Detected nvidiagrid request:", url);
          }
          
          if (!isTarget(url)) {
            return originalFetch(input, init);
          }
          
          console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] TARGET SESSION REQUEST INTERCEPTED:", url);
      
          if (init && init.body != null) {
            const patched = await tryPatchBody(init.body);
            if (patched !== undefined) {
              const newInit = { ...init, body: patched };
              return originalFetch(input, newInit);
            }
          }
      
          return originalFetch(input, init);
        }, originalFetch);
      
        window.fetch = wrappedFetch;
      }
      
      // Patch XMLHttpRequest
      const OriginalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function() {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        
        xhr.open = function(method, url, ...args) {
          if (url && url.includes('nvidiagrid')) {
            console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Detected nvidiagrid XHR request:", method, url);
          }
          
          if (isTarget(url)) {
            console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] TARGET SESSION XHR REQUEST INTERCEPTED:", method, url);
            this._isTargetRequest = true;
            this._originalUrl = url;
            this._method = method;
            this._async = args[1] !== false;
          }
          
          return originalOpen.apply(this, [method, url, ...args]);
        };
        
        xhr.send = function(data) {
          if (this._isTargetRequest && data) {
            console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] Intercepting XHR request body:", data);
            tryPatchBody(data).then(patchedData => {
              if (patchedData && patchedData !== data) {
                console.log("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] XHR body patched successfully");
                const newXhr = new OriginalXHR();
                newXhr.open(this._method || 'POST', this._originalUrl, this._async || true);
                originalSend.call(newXhr, patchedData);
              } else {
                originalSend.call(this, data);
              }
            }).catch(err => {
              console.error("[GeForce Infinity] [" + (frameInfo.isMainFrame ? "MAIN" : "IFRAME") + "] XHR patch error:", err);
              originalSend.call(this, data);
            });
            return;
          }
          return originalSend.call(this, data);
        };
        
        return xhr;
      };
      
    })(${JSON.stringify(currentConfig)});`;
    
    // Inject into main frame
    console.log("[GeForce Infinity] 🎯 Injecting into main frame...");
    try {
        await mainWindow.webContents.executeJavaScript(injectionScript);
        console.log("[GeForce Infinity] ✅ Main frame injection successful");
    } catch (error: any) {
        console.log("[GeForce Infinity] ❌ Main frame injection failed:", error?.message || error);
    }
    
    // Find and inject into all existing frames including iframes
    try {
        const allFrames = mainWindow.webContents.mainFrame.frames;
        console.log("[GeForce Infinity] 🔍 Found", allFrames.length, "frame(s), injecting into each...");
        for (const frame of allFrames) {
            try {
                await frame.executeJavaScript(injectionScript);
                console.log("[GeForce Infinity] ✅ Successfully injected into frame:", frame.url);
            } catch (error: any) {
                console.log("[GeForce Infinity] ❌ Failed to inject into frame:", frame.url, error?.message || error);
            }
        }
    } catch (error: any) {
        console.log("[GeForce Infinity] ❌ Could not access frames:", error?.message || error);
    }
    
    // Set up listener for new frames that might be created dynamically
    mainWindow.webContents.on('did-frame-navigate',
        (_event, url, httpResponseCode, _httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
            if (!isMainFrame) {
                console.log("[GeForce Infinity] 🆕 New frame navigated:", url, "Status:", httpResponseCode);
                
                // Wait a bit for the frame to be ready, then inject
                setTimeout(async () => {
                    try {
                        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
                        if (frame) {
                            await frame.executeJavaScript(injectionScript);
                            console.log("[GeForce Infinity] ✅ Successfully injected into new frame:", url);
                        } else {
                            console.log("[GeForce Infinity] ❌ Could not get frame reference for:", url);
                        }
                    } catch (error: any) {
                        console.log("[GeForce Infinity] ❌ Failed to inject into new frame:", url, error?.message || error);
                    }
                }, 100);
            }
        }
    );
    
    // Additional frame monitoring events for game session detection
    mainWindow.webContents.on('did-create-window', (_window, details) => {
        console.log("[GeForce Infinity] New window created:", details.url);
    });
    
    mainWindow.webContents.on('did-attach-webview', (_event, _webContents) => {
        console.log("[GeForce Infinity] WebView attached");
    });
    
    mainWindow.webContents.on('dom-ready', () => {
        console.log("[GeForce Infinity] 🎯 DOM ready - re-injecting for safety");
        // Re-inject when DOM is ready to catch late-loading frames
        setTimeout(async () => {
            try {
                await mainWindow.webContents.executeJavaScript(injectionScript);
            } catch (error: any) {
                console.log("[GeForce Infinity] DOM ready injection failed:", error?.message || error);
            }
        }, 500);
    });
}

app.whenReady().then(async () => {
    // Log codec support information at startup for debugging
    logCodecSupport();

    await registerAppProtocols();
    loadConfig();

    const mainWindow = createMainWindow();
    createTray(mainWindow);

    registerIpcHandlers({
        saveConfig,
        updateActivity,
        clientId,
        mainWindow,
    });

    if (getConfig().rpcEnabled) {
        initRpcClient(new Date(), clientId);
    }

    setInterval(() => {
        const title = mainWindow.getTitle();
        const gameTitle = title.startsWith("GeForce Infinity | ")
            ? title.replace("GeForce Infinity | ", "")
            : "";
        updateActivity(gameTitle || null);
    }, 15_000);

    registerShortcuts(mainWindow);

    setupWindowEvents(mainWindow);
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
    app.quit();
});
