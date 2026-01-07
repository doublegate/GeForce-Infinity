// Diagnostics IPC Handlers for GeForce Infinity
// Phase 1: Verification and Diagnostics implementation
// Exposes diagnostics functionality to the renderer process

import { BrowserWindow, ipcMain } from "electron";
import {
  generateDiagnosticsReport,
  runComprehensiveTests,
  getCodecCapabilities,
  getGPUInfo,
  getWebGLInfo,
  getPlatformInfo,
  getQuickSummary,
  logDiagnostics,
} from "../diagnostics/index.js";
import type {
  DiagnosticsReport,
  DiagnosticsTestResults,
  CodecCapabilities,
  GPUInfo,
  PlatformInfo,
} from "../diagnostics/types.js";

/**
 * Register all diagnostics IPC handlers
 * @param deps - Dependencies including the main window
 */
export function registerDiagnosticsHandlers({
  mainWindow,
}: {
  mainWindow: BrowserWindow;
}): void {
  console.log("[GeForce Infinity] Registering diagnostics IPC handlers...");

  // Get full diagnostics report (chrome://gpu style)
  ipcMain.handle(
    "get-diagnostics-report",
    async (): Promise<DiagnosticsReport> => {
      console.log("[GeForce Infinity] IPC: get-diagnostics-report");
      try {
        return await generateDiagnosticsReport(mainWindow.webContents);
      } catch (error) {
        console.error(
          "[GeForce Infinity] Error generating diagnostics report:",
          error,
        );
        throw error;
      }
    },
  );

  // Run comprehensive codec tests
  ipcMain.handle(
    "run-codec-tests",
    async (): Promise<DiagnosticsTestResults> => {
      console.log("[GeForce Infinity] IPC: run-codec-tests");
      try {
        return await runComprehensiveTests(mainWindow.webContents);
      } catch (error) {
        console.error("[GeForce Infinity] Error running codec tests:", error);
        throw error;
      }
    },
  );

  // Get codec capabilities only
  ipcMain.handle(
    "get-codec-capabilities",
    async (): Promise<CodecCapabilities> => {
      console.log("[GeForce Infinity] IPC: get-codec-capabilities");
      try {
        return await getCodecCapabilities(mainWindow.webContents);
      } catch (error) {
        console.error(
          "[GeForce Infinity] Error getting codec capabilities:",
          error,
        );
        throw error;
      }
    },
  );

  // Get GPU information only
  ipcMain.handle("get-gpu-info", async (): Promise<GPUInfo> => {
    console.log("[GeForce Infinity] IPC: get-gpu-info");
    try {
      const gpuInfo = await getGPUInfo();
      // Also get WebGL info
      const webglInfo = await getWebGLInfo(mainWindow.webContents);
      gpuInfo.webglRenderer = webglInfo.renderer;
      gpuInfo.webglVendor = webglInfo.vendor;
      return gpuInfo;
    } catch (error) {
      console.error("[GeForce Infinity] Error getting GPU info:", error);
      throw error;
    }
  });

  // Get platform information only
  ipcMain.handle("get-platform-info", async (): Promise<PlatformInfo> => {
    console.log("[GeForce Infinity] IPC: get-platform-info");
    try {
      return await getPlatformInfo();
    } catch (error) {
      console.error("[GeForce Infinity] Error getting platform info:", error);
      throw error;
    }
  });

  // Get quick summary for display
  ipcMain.handle(
    "get-diagnostics-summary",
    async (): Promise<{
      av1Support: boolean;
      hevcSupport: boolean;
      h264Support: boolean;
      max4K: boolean;
      gpuName: string;
    }> => {
      console.log("[GeForce Infinity] IPC: get-diagnostics-summary");
      try {
        return await getQuickSummary(mainWindow.webContents);
      } catch (error) {
        console.error(
          "[GeForce Infinity] Error getting diagnostics summary:",
          error,
        );
        throw error;
      }
    },
  );

  // Log diagnostics to console (for debugging)
  ipcMain.handle("log-diagnostics", async (): Promise<void> => {
    console.log("[GeForce Infinity] IPC: log-diagnostics");
    try {
      await logDiagnostics(mainWindow.webContents);
    } catch (error) {
      console.error("[GeForce Infinity] Error logging diagnostics:", error);
      throw error;
    }
  });

  console.log(
    "[GeForce Infinity] Diagnostics IPC handlers registered successfully",
  );
}
