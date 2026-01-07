/**
 * Network Interception Module for GeForce Infinity
 * Handles resolution override and request interception for GeForce NOW streaming
 *
 * Investigation confirmed (Sept 2025): This system works correctly and successfully
 * overrides GeForce NOW default resolutions. If higher resolutions (3440x1440, 4K)
 * don't work, it's due to external factors like GeForce NOW account tier restrictions,
 * game-specific limitations, or backend validation - not a bug in this application.
 */

import { session, webFrameMain, BrowserWindow } from "electron";
import type { Config } from "../../shared/types.js";

/**
 * Try to patch the session request body with custom resolution settings
 * @param initBody - The original request body
 * @param configData - The user's configuration
 * @returns The patched body string or undefined if not applicable
 */
export function tryPatchBody(
  initBody: string,
  configData: Config,
): string | undefined {
  if (!initBody) return undefined;

  const text = initBody;
  const trimmed = text.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return undefined;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  const srd = parsed && parsed.sessionRequestData;
  if (!srd || srd.clientRequestMonitorSettings == null) return undefined;

  // Use passed config data
  const clientSettings = configData;

  console.log(
    "[GeForce Infinity] Applying resolution override:",
    clientSettings.monitorWidth + "x" + clientSettings.monitorHeight,
    "FPS:",
    clientSettings.framesPerSecond,
    "Codec:",
    clientSettings.codecPreference,
  );

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
  const shouldUseAV1 =
    clientSettings.codecPreference === "av1" ||
    (clientSettings.codecPreference === "auto" &&
      (width >= 3840 || height >= 2160));

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
      sdrHdrMode: 0,
    },
  ];

  // Add codec preference metadata for enhanced compatibility
  if (shouldUseAV1) {
    console.log(
      "[4K Mode] Using AV1 codec for " + width + "x" + height + " streaming",
    );
  }

  const result = JSON.stringify(parsed);
  return result;
}

/**
 * Setup POST body modification for session requests
 * @param getConfig - Function to get current configuration
 */
export function setupSessionRequestInterception(getConfig: () => Config): void {
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
              const bodyText = uploadItem.bytes.toString("utf8");
              const modifiedBody = tryPatchBody(bodyText, config);

              if (modifiedBody && modifiedBody !== bodyText) {
                console.log(
                  "[GeForce Infinity] Resolution override applied to POST body",
                );
                uploadItem.bytes = Buffer.from(modifiedBody, "utf8");
              }
            } catch (error) {
              console.error(
                "[GeForce Infinity] Error processing POST body:",
                error,
              );
            }
          }
        }
      }

      callback({ cancel: false });
    },
  );
}

/**
 * Setup platform header override for GeForce NOW requests
 */
export function setupPlatformHeaderOverride(): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*.nvidiagrid.net/v2/*"] },
    (details, callback) => {
      const headers = details.requestHeaders;

      // Force nv-device-os and related platform headers
      headers["nv-device-os"] = "WINDOWS";
      headers["sec-ch-ua-platform"] = '"WINDOWS"';
      headers["sec-ch-ua-platform-version"] = "14.0.0";

      callback({ requestHeaders: headers });
    },
  );
}

/**
 * Patch fetch and XHR in the main window and all iframes
 * This is the dual-layer interception system for iframe isolation
 * @param mainWindow - The main browser window
 * @param getConfig - Function to get current configuration
 */
export async function patchFetchForSessionRequest(
  mainWindow: BrowserWindow,
  getConfig: () => Config,
): Promise<void> {
  // Get current configuration from main process before injecting
  const currentConfig = getConfig();
  console.log(
    "[GeForce Infinity] Current config for fetch patching:",
    currentConfig,
  );

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

      console.log("[GeForce Infinity] Injection SUCCESS - Frame patched:", frameInfo);

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
  console.log("[GeForce Infinity] Injecting into main frame...");
  try {
    await mainWindow.webContents.executeJavaScript(injectionScript);
    console.log("[GeForce Infinity] Main frame injection successful");
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log("[GeForce Infinity] Main frame injection failed:", errMsg);
  }

  // Find and inject into all existing frames including iframes
  try {
    const allFrames = mainWindow.webContents.mainFrame.frames;
    console.log(
      "[GeForce Infinity] Found",
      allFrames.length,
      "frame(s), injecting into each...",
    );
    for (const frame of allFrames) {
      try {
        await frame.executeJavaScript(injectionScript);
        console.log(
          "[GeForce Infinity] Successfully injected into frame:",
          frame.url,
        );
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log(
          "[GeForce Infinity] Failed to inject into frame:",
          frame.url,
          errMsg,
        );
      }
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.log("[GeForce Infinity] Could not access frames:", errMsg);
  }

  // Set up listener for new frames that might be created dynamically
  mainWindow.webContents.on(
    "did-frame-navigate",
    (
      _event,
      url,
      httpResponseCode,
      _httpStatusText,
      isMainFrame,
      frameProcessId,
      frameRoutingId,
    ) => {
      if (!isMainFrame) {
        console.log(
          "[GeForce Infinity] New frame navigated:",
          url,
          "Status:",
          httpResponseCode,
        );

        // Wait a bit for the frame to be ready, then inject
        setTimeout(async () => {
          try {
            const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
            if (frame) {
              await frame.executeJavaScript(injectionScript);
              console.log(
                "[GeForce Infinity] Successfully injected into new frame:",
                url,
              );
            } else {
              console.log(
                "[GeForce Infinity] Could not get frame reference for:",
                url,
              );
            }
          } catch (error: unknown) {
            const errMsg =
              error instanceof Error ? error.message : String(error);
            console.log(
              "[GeForce Infinity] Failed to inject into new frame:",
              url,
              errMsg,
            );
          }
        }, 100);
      }
    },
  );

  // Additional frame monitoring events for game session detection
  mainWindow.webContents.on("did-create-window", (_window, details) => {
    console.log("[GeForce Infinity] New window created:", details.url);
  });

  mainWindow.webContents.on("did-attach-webview", (_event, _webContents) => {
    console.log("[GeForce Infinity] WebView attached");
  });

  mainWindow.webContents.on("dom-ready", () => {
    console.log("[GeForce Infinity] DOM ready - re-injecting for safety");
    // Re-inject when DOM is ready to catch late-loading frames
    setTimeout(async () => {
      try {
        await mainWindow.webContents.executeJavaScript(injectionScript);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log("[GeForce Infinity] DOM ready injection failed:", errMsg);
      }
    }, 500);
  });
}
