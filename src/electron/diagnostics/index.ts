// Main Diagnostics Module for GeForce Infinity
// Phase 1: Verification and Diagnostics implementation
// Provides comprehensive codec and GPU diagnostics

import type { WebContents } from "electron";
import { getCodecCapabilities, runCodecTests } from "./codec-detection.js";
import {
  getGPUInfo,
  getBasicGPUInfo,
  getWebGLInfo,
  getGPUSummary,
} from "./gpu-info.js";
import {
  getPlatformInfo,
  getPlatformRecommendations,
  getPlatformWarnings,
} from "./platform-checks.js";
import type {
  CodecCapabilities,
  DiagnosticsReport,
  DiagnosticsTestResults,
  PlatformInfo,
} from "./types.js";

// Re-export types for external use
export type {
  CodecCapabilities,
  CodecInfo,
  GPUInfo,
  GPUFeatureStatus,
  PlatformInfo,
  DiagnosticsReport,
  DiagnosticsTestResults,
  CodecTestResult,
} from "./types.js";

// Re-export individual modules
export {
  getCodecCapabilities,
  runCodecTests,
  CODEC_STRINGS,
} from "./codec-detection.js";
export {
  getGPUInfo,
  getBasicGPUInfo,
  getWebGLInfo,
  getGPUSummary,
} from "./gpu-info.js";
export {
  getPlatformInfo,
  getVaapiProfiles,
  getDriverInfo,
  getPlatformRecommendations,
  getPlatformWarnings,
} from "./platform-checks.js";

/**
 * Generate a comprehensive diagnostics report
 * This provides a chrome://gpu style report for users
 * @param webContents - Electron WebContents for renderer-side detection
 * @returns Promise<DiagnosticsReport> - Complete diagnostics report
 */
export async function generateDiagnosticsReport(
  webContents: WebContents,
): Promise<DiagnosticsReport> {
  console.log("[GeForce Infinity] Generating diagnostics report...");

  // Gather all information in parallel where possible
  const [platformInfo, gpuInfo, codecCapabilities, webglInfo] =
    await Promise.all([
      getPlatformInfo(),
      getGPUInfo(),
      getCodecCapabilities(webContents),
      getWebGLInfo(webContents),
    ]);

  // Merge WebGL info into GPU info
  gpuInfo.webglRenderer = webglInfo.renderer;
  gpuInfo.webglVendor = webglInfo.vendor;

  // Get recommendations and warnings
  const [recommendations, warnings] = await Promise.all([
    getPlatformRecommendations(),
    getPlatformWarnings(),
  ]);

  // Add codec-specific recommendations
  const codecRecommendations = generateCodecRecommendations(
    codecCapabilities,
    platformInfo,
  );
  recommendations.push(...codecRecommendations);

  const report: DiagnosticsReport = {
    timestamp: new Date().toISOString(),
    platform: platformInfo,
    gpu: gpuInfo,
    codecs: codecCapabilities,
    recommendations,
    warnings,
  };

  console.log("[GeForce Infinity] Diagnostics report generated:", report);
  return report;
}

/**
 * Run comprehensive codec tests
 * @param webContents - Electron WebContents for renderer-side testing
 * @returns Promise<DiagnosticsTestResults> - Detailed test results
 */
export async function runComprehensiveTests(
  webContents: WebContents,
): Promise<DiagnosticsTestResults> {
  console.log("[GeForce Infinity] Running comprehensive codec tests...");

  const tests = await runCodecTests(webContents);
  const passedCount = tests.filter((t) => t.supported).length;
  const totalCount = tests.length;

  let overallStatus: DiagnosticsTestResults["overallStatus"];
  let summary: string;

  if (passedCount === totalCount) {
    overallStatus = "passed";
    summary = `All ${totalCount} codec tests passed. Full codec support available.`;
  } else if (passedCount === 0) {
    overallStatus = "failed";
    summary = `All ${totalCount} codec tests failed. Check GPU drivers and hardware acceleration.`;
  } else {
    overallStatus = "partial";
    summary = `${passedCount} of ${totalCount} codec tests passed. Some codecs may require additional setup.`;
  }

  const results: DiagnosticsTestResults = {
    timestamp: new Date().toISOString(),
    tests,
    overallStatus,
    summary,
  };

  console.log("[GeForce Infinity] Test results:", results);
  return results;
}

/**
 * Generate codec-specific recommendations based on test results
 * @param codecs - Codec capabilities
 * @param platform - Platform information
 * @returns string[] - Codec recommendations
 */
function generateCodecRecommendations(
  codecs: CodecCapabilities,
  platform: PlatformInfo,
): string[] {
  const recommendations: string[] = [];

  // AV1 recommendations
  if (!codecs.av1.decode4K) {
    recommendations.push(
      "AV1 4K decoding not supported. For best 4K streaming, consider a GPU with AV1 hardware decode (Intel Arc, NVIDIA RTX 30+, AMD RX 6000+).",
    );
  } else if (!codecs.av1.hardwareAccelerated) {
    recommendations.push(
      "AV1 decoding is available but may be software-only. Check GPU driver installation.",
    );
  }

  // HEVC recommendations
  if (!codecs.hevc.decode4K) {
    if (platform.platform === "win32" && !platform.hevcExtensionsInstalled) {
      recommendations.push(
        "HEVC 4K decoding not available. Install HEVC Video Extensions from Microsoft Store.",
      );
    } else if (platform.platform === "linux" && !platform.vaapiAvailable) {
      recommendations.push(
        "HEVC 4K decoding not available. Install VAAPI drivers for your GPU.",
      );
    }
  }

  // H.264 recommendations (should always be available)
  if (!codecs.h264.decode1080p) {
    recommendations.push(
      "H.264 decoding not working. This is unusual - check your Electron/Chromium installation.",
    );
  }

  // GeForce NOW specific recommendations
  if (codecs.av1.decode4K && codecs.hevc.decode4K) {
    recommendations.push(
      "Your system supports both AV1 and HEVC at 4K. You are ready for GeForce NOW Ultimate tier streaming.",
    );
  } else if (codecs.hevc.decode1440p) {
    recommendations.push(
      "Your system supports HEVC at 1440p. You can use GeForce NOW at high resolutions.",
    );
  } else {
    recommendations.push(
      "Limited high-resolution codec support. You may be limited to 1080p streaming with H.264.",
    );
  }

  return recommendations;
}

/**
 * Get a quick summary of codec support status
 * @param webContents - Electron WebContents
 * @returns Promise<object> - Quick summary
 */
export async function getQuickSummary(webContents: WebContents): Promise<{
  av1Support: boolean;
  hevcSupport: boolean;
  h264Support: boolean;
  max4K: boolean;
  gpuName: string;
}> {
  const [codecs, gpuInfo] = await Promise.all([
    getCodecCapabilities(webContents),
    getBasicGPUInfo(),
  ]);

  return {
    av1Support: codecs.av1.decode4K || codecs.av1.decode1080p,
    hevcSupport: codecs.hevc.decode4K || codecs.hevc.decode1080p,
    h264Support: codecs.h264.decode1080p,
    max4K: codecs.av1.decode4K || codecs.hevc.decode4K,
    gpuName: `${gpuInfo.vendor} ${gpuInfo.model}`,
  };
}

/**
 * Log diagnostics to console for debugging
 * @param webContents - Electron WebContents
 */
export async function logDiagnostics(webContents: WebContents): Promise<void> {
  console.log("[GeForce Infinity] ============ DIAGNOSTICS ============");

  const report = await generateDiagnosticsReport(webContents);

  console.log("[GeForce Infinity] Platform:", report.platform);
  console.log("[GeForce Infinity] GPU:", getGPUSummary(report.gpu));
  console.log("[GeForce Infinity] Codecs:", report.codecs);
  console.log("[GeForce Infinity] Recommendations:", report.recommendations);
  console.log("[GeForce Infinity] Warnings:", report.warnings);

  console.log("[GeForce Infinity] =====================================");
}
