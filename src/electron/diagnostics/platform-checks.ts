// Platform-Specific Checks Module for GeForce Infinity
// Phase 1: Verification and Diagnostics implementation
// Performs platform-specific checks for codec and driver requirements

import { execSync, execFile } from "child_process";
import { promisify } from "util";
import type { PlatformInfo } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Safely execute a command and return stdout
 * Uses execFile for safety (no shell injection possible)
 * @param command - Command to execute
 * @param args - Command arguments
 * @returns Promise<string> - stdout or empty string on error
 */
async function safeExec(command: string, args: string[] = []): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 5000 });
    return stdout;
  } catch {
    return "";
  }
}

/**
 * Safely execute a shell command (for complex pipelines only)
 * Only used with static commands, never with user input
 * @param command - Static shell command
 * @returns string - stdout or empty string on error
 */
function safeExecSync(command: string): string {
  try {
    return execSync(command, { encoding: "utf8", timeout: 5000 });
  } catch {
    return "";
  }
}

/**
 * Get comprehensive platform information
 * @returns Promise<PlatformInfo> - Platform details including OS, Electron, and driver info
 */
export async function getPlatformInfo(): Promise<PlatformInfo> {
  const baseInfo: PlatformInfo = {
    platform: process.platform,
    arch: process.arch,
    osVersion: getOSVersion(),
    electronVersion: process.versions.electron || "Unknown",
    chromiumVersion: process.versions.chrome || "Unknown",
    nodeVersion: process.versions.node || "Unknown",
    v8Version: process.versions.v8 || "Unknown",
  };

  // Add platform-specific checks
  if (process.platform === "linux") {
    baseInfo.vaapiAvailable = await checkVaapiAvailable();
  } else if (process.platform === "win32") {
    baseInfo.hevcExtensionsInstalled = await checkHEVCExtensions();
  } else if (process.platform === "darwin") {
    baseInfo.videoToolboxAvailable = checkVideoToolbox();
  }

  return baseInfo;
}

/**
 * Get OS version string
 * @returns string - OS version
 */
function getOSVersion(): string {
  try {
    if (process.platform === "linux") {
      const result = safeExecSync("cat /etc/os-release 2>/dev/null");
      if (result) {
        const nameMatch = result.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
        return nameMatch ? nameMatch[1] : process.release.name || "Linux";
      }
      return `Linux ${process.release?.name || ""}`.trim();
    } else if (process.platform === "darwin") {
      const result = safeExecSync("sw_vers -productVersion");
      return result ? `macOS ${result.trim()}` : "macOS";
    } else if (process.platform === "win32") {
      return `Windows ${process.getSystemVersion?.() || ""}`.trim();
    }
  } catch (error) {
    console.error("[GeForce Infinity] Failed to get OS version:", error);
  }
  return process.platform;
}

/**
 * Check if VAAPI is available on Linux
 * @returns Promise<boolean> - Whether VAAPI is available
 */
async function checkVaapiAvailable(): Promise<boolean> {
  if (process.platform !== "linux") return false;

  try {
    // Try to run vainfo to check VAAPI availability
    const stdout = await safeExec("vainfo", []);
    if (stdout) {
      const hasVaapi =
        stdout.includes("VA-API version") || stdout.includes("vainfo:");
      console.log(
        "[GeForce Infinity] VAAPI check:",
        hasVaapi ? "Available" : "Not Available",
      );
      return hasVaapi;
    }

    // vainfo not installed or failed - try alternative check
    const lsResult = safeExecSync("ls /dev/dri/renderD* 2>/dev/null");
    const hasRenderNodes = lsResult.trim().length > 0;
    console.log(
      "[GeForce Infinity] DRI render nodes:",
      hasRenderNodes ? "Found" : "Not Found",
    );
    return hasRenderNodes;
  } catch {
    return false;
  }
}

/**
 * Get detailed VAAPI information on Linux
 * @returns Promise<string[]> - List of supported VAAPI profiles
 */
export async function getVaapiProfiles(): Promise<string[]> {
  if (process.platform !== "linux") return [];

  try {
    const stdout = await safeExec("vainfo", []);
    if (!stdout) return [];

    const profiles: string[] = [];
    const lines = stdout.split("\n");

    for (const line of lines) {
      if (line.includes("VAProfile") && line.includes(":")) {
        const match = line.match(/VAProfile(\w+)/);
        if (match) {
          profiles.push(match[1]);
        }
      }
    }

    console.log("[GeForce Infinity] VAAPI profiles:", profiles);
    return profiles;
  } catch {
    return [];
  }
}

/**
 * Check if HEVC Video Extensions are installed on Windows
 * @returns Promise<boolean> - Whether HEVC extensions are installed
 */
async function checkHEVCExtensions(): Promise<boolean> {
  if (process.platform !== "win32") return false;

  try {
    // Check for HEVC Video Extensions via PowerShell
    const stdout = await safeExec("powershell", [
      "-Command",
      "Get-AppxPackage -Name Microsoft.HEVCVideoExtension* | Select-Object -ExpandProperty Name",
    ]);
    if (stdout.trim().length > 0) {
      console.log("[GeForce Infinity] HEVC Extensions: Installed");
      return true;
    }

    // Alternative check - look for the free manufacturer version
    const altStdout = await safeExec("powershell", [
      "-Command",
      "Get-AppxPackage -Name *HEVCVideo* | Select-Object -ExpandProperty Name",
    ]);
    const hasExtensions = altStdout.trim().length > 0;
    console.log(
      "[GeForce Infinity] HEVC Extensions:",
      hasExtensions ? "Installed" : "Not Installed",
    );
    return hasExtensions;
  } catch {
    return false;
  }
}

/**
 * Check if VideoToolbox is available on macOS
 * @returns boolean - Whether VideoToolbox is available
 */
function checkVideoToolbox(): boolean {
  if (process.platform !== "darwin") return false;

  try {
    // VideoToolbox is available on macOS 10.8+ and always present on modern macOS
    const version = safeExecSync("sw_vers -productVersion").trim();
    if (!version) return true; // Assume available on macOS
    const [major] = version.split(".").map(Number);
    // macOS 10.8+ (or macOS 11+ for Big Sur and later)
    const available = major >= 10 || major >= 11;
    console.log(
      "[GeForce Infinity] VideoToolbox:",
      available ? "Available" : "Not Available",
    );
    return available;
  } catch {
    return true; // Assume available on macOS
  }
}

/**
 * Get GPU driver information for the current platform
 * @returns Promise<{driver: string, version: string}> - Driver information
 */
export async function getDriverInfo(): Promise<{
  driver: string;
  version: string;
}> {
  if (process.platform === "linux") {
    return await getLinuxDriverInfo();
  } else if (process.platform === "win32") {
    return await getWindowsDriverInfo();
  } else if (process.platform === "darwin") {
    return { driver: "Apple Metal/VideoToolbox", version: "Native" };
  }
  return { driver: "Unknown", version: "Unknown" };
}

/**
 * Get Linux GPU driver information
 * @returns Promise<{driver: string, version: string}> - Driver info
 */
async function getLinuxDriverInfo(): Promise<{
  driver: string;
  version: string;
}> {
  try {
    // Check for NVIDIA
    const nvidiaResult = await safeExec("nvidia-smi", [
      "--query-gpu=driver_version",
      "--format=csv,noheader",
    ]);
    if (nvidiaResult.trim()) {
      return { driver: "NVIDIA Proprietary", version: nvidiaResult.trim() };
    }

    // Check for Mesa (AMD/Intel) - requires shell for grep
    const glxResult = safeExecSync(
      "glxinfo 2>/dev/null | grep 'OpenGL version'",
    );
    if (glxResult) {
      const match = glxResult.match(/Mesa (\d+\.\d+\.\d+)/);
      if (match) {
        return { driver: "Mesa", version: match[1] };
      }
    }

    // Fallback
    return { driver: "Unknown Linux Driver", version: "Unknown" };
  } catch {
    return { driver: "Unknown", version: "Unknown" };
  }
}

/**
 * Get Windows GPU driver information
 * @returns Promise<{driver: string, version: string}> - Driver info
 */
async function getWindowsDriverInfo(): Promise<{
  driver: string;
  version: string;
}> {
  try {
    const stdout = await safeExec("powershell", [
      "-Command",
      "Get-WmiObject Win32_VideoController | Select-Object -ExpandProperty DriverVersion",
    ]);
    const version = stdout.trim().split("\n")[0];
    return { driver: "Windows Display Driver", version: version || "Unknown" };
  } catch {
    return { driver: "Windows Display Driver", version: "Unknown" };
  }
}

/**
 * Get platform-specific recommendations for optimal codec support
 * @returns Promise<string[]> - List of recommendations
 */
export async function getPlatformRecommendations(): Promise<string[]> {
  const recommendations: string[] = [];

  if (process.platform === "linux") {
    const vaapiAvailable = await checkVaapiAvailable();
    if (!vaapiAvailable) {
      recommendations.push(
        "Install VAAPI drivers for hardware-accelerated video decoding",
      );
      recommendations.push(
        "For Intel: install intel-media-driver or libva-intel-driver",
      );
      recommendations.push("For AMD: install libva-mesa-driver");
      recommendations.push(
        "For NVIDIA: install libva-nvidia-driver (experimental)",
      );
    }

    const profiles = await getVaapiProfiles();
    if (profiles.length > 0) {
      if (!profiles.some((p) => p.includes("AV1"))) {
        recommendations.push("Your GPU may not support hardware AV1 decoding");
      }
      if (!profiles.some((p) => p.includes("HEVC"))) {
        recommendations.push("Your GPU may not support hardware HEVC decoding");
      }
    }
  } else if (process.platform === "win32") {
    const hevcInstalled = await checkHEVCExtensions();
    if (!hevcInstalled) {
      recommendations.push(
        "Install HEVC Video Extensions from Microsoft Store for HEVC support",
      );
      recommendations.push(
        "Free version may be available from your GPU manufacturer",
      );
    }
  } else if (process.platform === "darwin") {
    recommendations.push(
      "macOS uses VideoToolbox for hardware acceleration (built-in)",
    );
    recommendations.push(
      "Ensure you are running macOS Big Sur (11.0) or later for optimal codec support",
    );
  }

  return recommendations;
}

/**
 * Get platform-specific warnings
 * @returns Promise<string[]> - List of warnings
 */
export async function getPlatformWarnings(): Promise<string[]> {
  const warnings: string[] = [];

  if (process.platform === "linux") {
    // Check for Wayland session
    const sessionType = process.env.XDG_SESSION_TYPE;
    if (sessionType === "wayland") {
      warnings.push(
        "Running on Wayland - some features may behave differently",
      );
    }

    // Check NVIDIA driver version
    const nvidiaVersion = safeExecSync(
      "cat /sys/module/nvidia/version 2>/dev/null",
    ).trim();
    if (nvidiaVersion) {
      const version = parseInt(nvidiaVersion.split(".")[0]);
      if (version < 515) {
        warnings.push(
          "NVIDIA driver version is older than 515 - consider updating for best AV1 support",
        );
      }
    }
  }

  return warnings;
}
