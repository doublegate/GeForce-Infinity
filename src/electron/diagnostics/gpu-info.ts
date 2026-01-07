// GPU Information Module for GeForce Infinity
// Phase 1: Verification and Diagnostics implementation
// Uses Electron's app.getGPUInfo() to gather GPU details

import { app } from "electron";
import type { WebContents } from "electron";
import type { GPUInfo, GPUFeatureStatus } from "./types.js";

// Internal type for raw GPU info from Electron
interface RawGPUInfo {
  gpuDevice?: Array<{
    vendorId?: number;
    deviceId?: number;
    vendorString?: string;
    deviceString?: string;
    driverVersion?: string;
  }>;
  auxAttributes?: {
    systemTotalMemoryMb?: number;
  };
  featureStatus?: Record<string, string>;
}

/**
 * Get comprehensive GPU information from Electron
 * @returns Promise<GPUInfo> - GPU details including vendor, model, driver, and features
 */
export async function getGPUInfo(): Promise<GPUInfo> {
  try {
    const gpuInfo = (await app.getGPUInfo("complete")) as RawGPUInfo;
    console.log(
      "[GeForce Infinity] Raw GPU Info:",
      JSON.stringify(gpuInfo, null, 2),
    );
    return parseGPUInfo(gpuInfo);
  } catch (error) {
    console.error("[GeForce Infinity] Failed to get GPU info:", error);
    return getDefaultGPUInfo();
  }
}

/**
 * Get basic GPU information (faster, less detailed)
 * @returns Promise<GPUInfo> - Basic GPU details
 */
export async function getBasicGPUInfo(): Promise<GPUInfo> {
  try {
    const gpuInfo = (await app.getGPUInfo("basic")) as RawGPUInfo;
    return parseGPUInfo(gpuInfo);
  } catch (error) {
    console.error("[GeForce Infinity] Failed to get basic GPU info:", error);
    return getDefaultGPUInfo();
  }
}

/**
 * Get WebGL renderer information from the renderer process
 * @param webContents - Electron WebContents to execute JavaScript in
 * @returns Promise<{renderer: string, vendor: string}> - WebGL info
 */
export async function getWebGLInfo(
  webContents: WebContents,
): Promise<{ renderer: string | null; vendor: string | null }> {
  const script = `
        (() => {
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (!gl) {
                    return { renderer: null, vendor: null };
                }
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (!debugInfo) {
                    return {
                        renderer: gl.getParameter(gl.RENDERER),
                        vendor: gl.getParameter(gl.VENDOR)
                    };
                }
                return {
                    renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                    vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
                };
            } catch (e) {
                console.error('[GeForce Infinity] WebGL info error:', e);
                return { renderer: null, vendor: null };
            }
        })()
    `;

  try {
    return await webContents.executeJavaScript(script);
  } catch (error) {
    console.error("[GeForce Infinity] Failed to get WebGL info:", error);
    return { renderer: null, vendor: null };
  }
}

/**
 * Parse raw GPU info from Electron into structured format
 * @param rawInfo - Raw GPU info object from app.getGPUInfo()
 * @returns GPUInfo - Structured GPU information
 */
function parseGPUInfo(rawInfo: RawGPUInfo): GPUInfo {
  // Extract GPU device information
  const gpuDevice = rawInfo?.gpuDevice?.[0] || {};
  const auxAttributes = rawInfo?.auxAttributes || {};

  // Determine vendor name
  let vendor = "Unknown";
  const vendorId = gpuDevice.vendorId;
  if (vendorId) {
    if (vendorId === 0x10de || vendorId === 4318) vendor = "NVIDIA";
    else if (vendorId === 0x1002 || vendorId === 4098) vendor = "AMD";
    else if (vendorId === 0x8086 || vendorId === 32902) vendor = "Intel";
    else if (vendorId === 0x106b) vendor = "Apple";
    else vendor = gpuDevice.vendorString || `Vendor ${vendorId}`;
  } else if (gpuDevice.vendorString) {
    vendor = gpuDevice.vendorString;
  }

  // Extract feature statuses
  const features: GPUFeatureStatus[] = parseFeatureStatus(
    rawInfo?.featureStatus || {},
  );

  // Check for video decode/encode acceleration
  const videoDecodeAccelerated = checkVideoDecodeStatus(rawInfo);
  const videoEncodeAccelerated = checkVideoEncodeStatus(rawInfo);

  return {
    vendor,
    model:
      gpuDevice.deviceString || gpuDevice.deviceId?.toString() || "Unknown",
    driverVersion: gpuDevice.driverVersion || "Unknown",
    gpuMemoryMB: auxAttributes.systemTotalMemoryMb || null,
    videoDecodeAccelerated,
    videoEncodeAccelerated,
    webglRenderer: null, // Will be populated separately via getWebGLInfo
    webglVendor: null,
    features,
    rawInfo,
  };
}

/**
 * Parse feature status from GPU info
 * @param featureStatus - Feature status object from GPU info
 * @returns GPUFeatureStatus[] - Array of feature statuses
 */
function parseFeatureStatus(
  featureStatus: Record<string, string>,
): GPUFeatureStatus[] {
  const features: GPUFeatureStatus[] = [];

  const importantFeatures = [
    "2d_canvas",
    "gpu_compositing",
    "video_decode",
    "video_encode",
    "rasterization",
    "webgl",
    "webgl2",
    "webgpu",
    "vulkan",
    "metal",
  ];

  for (const [name, status] of Object.entries(featureStatus)) {
    if (
      importantFeatures.includes(name) ||
      name.includes("video") ||
      name.includes("decode")
    ) {
      let normalizedStatus: GPUFeatureStatus["status"] = "unavailable";
      const statusLower = (status || "").toLowerCase();

      if (statusLower.includes("enabled") || statusLower.includes("hardware")) {
        normalizedStatus = "enabled";
      } else if (statusLower.includes("software")) {
        normalizedStatus = "software";
      } else if (statusLower.includes("disabled")) {
        normalizedStatus = "disabled";
      }

      features.push({ name, status: normalizedStatus });
    }
  }

  return features;
}

/**
 * Check if video decode acceleration is enabled
 * @param rawInfo - Raw GPU info
 * @returns boolean - Whether video decode is hardware accelerated
 */
function checkVideoDecodeStatus(rawInfo: RawGPUInfo): boolean {
  const featureStatus = rawInfo?.featureStatus || {};
  const videoDecodeStatus = featureStatus.video_decode || "";

  return (
    videoDecodeStatus.toLowerCase().includes("enabled") ||
    videoDecodeStatus.toLowerCase().includes("hardware")
  );
}

/**
 * Check if video encode acceleration is enabled
 * @param rawInfo - Raw GPU info
 * @returns boolean - Whether video encode is hardware accelerated
 */
function checkVideoEncodeStatus(rawInfo: RawGPUInfo): boolean {
  const featureStatus = rawInfo?.featureStatus || {};
  const videoEncodeStatus = featureStatus.video_encode || "";

  return (
    videoEncodeStatus.toLowerCase().includes("enabled") ||
    videoEncodeStatus.toLowerCase().includes("hardware")
  );
}

/**
 * Get default GPU info when detection fails
 * @returns GPUInfo - Default GPU info with unknown values
 */
function getDefaultGPUInfo(): GPUInfo {
  return {
    vendor: "Unknown",
    model: "Unknown",
    driverVersion: "Unknown",
    gpuMemoryMB: null,
    videoDecodeAccelerated: false,
    videoEncodeAccelerated: false,
    webglRenderer: null,
    webglVendor: null,
    features: [],
  };
}

/**
 * Get a human-readable summary of GPU capabilities
 * @param gpuInfo - GPU information object
 * @returns string - Human-readable summary
 */
export function getGPUSummary(gpuInfo: GPUInfo): string {
  const parts: string[] = [];

  parts.push(`GPU: ${gpuInfo.vendor} ${gpuInfo.model}`);
  parts.push(`Driver: ${gpuInfo.driverVersion}`);
  parts.push(
    `Video Decode: ${gpuInfo.videoDecodeAccelerated ? "Hardware" : "Software/Disabled"}`,
  );
  parts.push(
    `Video Encode: ${gpuInfo.videoEncodeAccelerated ? "Hardware" : "Software/Disabled"}`,
  );

  if (gpuInfo.gpuMemoryMB) {
    parts.push(`Memory: ${gpuInfo.gpuMemoryMB} MB`);
  }

  return parts.join(" | ");
}
