import type { Config } from "../shared/types";

// Diagnostics types for the overlay
export interface CodecCapabilities {
  av1: {
    decode1080p: boolean;
    decode1440p: boolean;
    decode4K: boolean;
    hardwareAccelerated: boolean | null;
  };
  hevc: {
    decode1080p: boolean;
    decode1440p: boolean;
    decode4K: boolean;
    hardwareAccelerated: boolean | null;
  };
  h264: {
    decode1080p: boolean;
    decode4K: boolean;
    hardwareAccelerated: boolean | null;
  };
  vp9: {
    decode1080p: boolean;
    decode4K: boolean;
    hardwareAccelerated: boolean | null;
  };
}

export interface GPUFeatureStatus {
  name: string;
  status: "enabled" | "disabled" | "unavailable" | "software";
}

export interface GPUInfo {
  vendor: string;
  model: string;
  driverVersion: string;
  gpuMemoryMB: number | null;
  videoDecodeAccelerated: boolean;
  videoEncodeAccelerated: boolean;
  webglRenderer: string | null;
  webglVendor: string | null;
  features: GPUFeatureStatus[];
  rawInfo?: object;
}

export interface PlatformInfo {
  platform: string;
  arch: string;
  osVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  v8Version: string;
  vaapiAvailable?: boolean;
  hevcExtensionsInstalled?: boolean;
  videoToolboxAvailable?: boolean;
}

export interface CodecTestResult {
  codec: string;
  resolution: string;
  supported: boolean;
  hardwareAccelerated: boolean | null;
  error?: string;
}

export interface DiagnosticsTestResults {
  timestamp: string;
  tests: CodecTestResult[];
  overallStatus: "passed" | "partial" | "failed";
  summary: string;
}

export interface DiagnosticsReport {
  timestamp: string;
  platform: PlatformInfo;
  gpu: GPUInfo;
  codecs: CodecCapabilities;
  recommendations: string[];
  warnings: string[];
}

export interface DiagnosticsSummary {
  av1Support: boolean;
  hevcSupport: boolean;
  h264Support: boolean;
  max4K: boolean;
  gpuName: string;
}

declare global {
  interface Window {
    electronAPI: {
      onSidebarToggle: (callback: () => void) => void;
      openExternal: (url: string) => void;
      saveConfig: (config: Partial<Config>) => void;
      getCurrentConfig: () => Promise<Config>;
      onConfigLoaded: (callback: (config: Config) => void) => void;
      getTailwindCss: () => string;
      reloadGFN: () => void;
    };
    diagnostics: {
      getDiagnosticsReport: () => Promise<DiagnosticsReport>;
      runCodecTests: () => Promise<DiagnosticsTestResults>;
      getCodecCapabilities: () => Promise<CodecCapabilities>;
      getGPUInfo: () => Promise<GPUInfo>;
      getPlatformInfo: () => Promise<PlatformInfo>;
      getDiagnosticsSummary: () => Promise<DiagnosticsSummary>;
      logDiagnostics: () => Promise<void>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
