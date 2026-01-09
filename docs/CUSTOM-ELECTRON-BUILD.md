# Custom Electron Build Planning Document

**Project:** GeForce Infinity
**Document Version:** 1.0.0
**Date:** January 2026
**Current Version:** v1.4.0 (master)
**Current Electron:** 37.2.0 (Chromium 138.0.7204.35, Node.js 22.16.0)

---

## Executive Summary

This document provides a comprehensive analysis and planning guide for custom Electron builds in the context of GeForce Infinity, a GeForce NOW streaming client that provides resolution override capabilities for high-resolution (3440x1440, 4K, 5K+) and high-framerate (120fps+) gaming.

### Key Conclusions

1. **Custom Electron builds are unnecessary** for the primary use case of AV1/HEVC streaming
2. **Current implementation is optimal** - GeForce Infinity v1.4.0 already has comprehensive hardware acceleration flags
3. **Resolution override system works correctly** - Investigation confirmed successful API interception
4. **Diagnostics feature ready** - The diag_panel branch contains complete implementation pending merge

### Recommendation

**Enhanced Configuration (Current Approach)** remains the recommended strategy. Custom Electron builds should only be pursued if future GeForce NOW requirements mandate codecs not available in standard builds.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Codec Support Summary](#2-codec-support-summary)
3. [Hardware Acceleration Configuration](#3-hardware-acceleration-configuration)
4. [Custom Build Decision Matrix](#4-custom-build-decision-matrix)
5. [Implementation Options](#5-implementation-options)
6. [Diagnostics Feature Status](#6-diagnostics-feature-status)
7. [Roadmap and Recommendations](#7-roadmap-and-recommendations)
8. [Appendix: Research Documents](#8-appendix-research-documents)

---

## 1. Current Architecture Analysis

### 1.1 Application Stack

```
GeForce Infinity v1.4.0
├── Electron 37.2.0
│   ├── Chromium 138.0.7204.35
│   │   ├── FFmpeg (shared library)
│   │   │   ├── AV1 (dav1d/libgav1) ✅
│   │   │   ├── VP8/VP9 ✅
│   │   │   ├── H.264/AVC ✅
│   │   │   ├── HEVC ⚠️ Hardware only
│   │   │   └── AC3/E-AC3 ❌
│   │   └── Hardware Decoders
│   │       ├── VAAPI (Linux) ✅ Configured
│   │       ├── D3D11/DXVA (Windows) ✅ Native
│   │       └── VideoToolbox (macOS) ✅ Native
│   ├── V8 13.8
│   └── Node.js 22.16.0
├── Resolution Override System ✅ Working
│   ├── webRequest API interception
│   └── iframe fetch/XHR patching
└── React Overlay UI
```

### 1.2 Resolution Override System

The v1.4.0 release achieved a major breakthrough with the resolution override system:

**Dual-Layer Interception Architecture:**
1. **webRequest API:** Intercepts HTTP requests at session layer
2. **iframe injection:** Uses `webFrameMain` API to patch fetch/XHR in isolated frames

**Verified Working (September 2025):**
- 3440x1440 ultrawide resolution
- 4K (3840x2160) streaming
- 120fps high refresh rate
- AV1/HEVC codec selection

**Note:** If users experience resolution limitations, the cause is external factors (GeForce NOW tier restrictions, game limitations, server-side validation), not application bugs.

### 1.3 Hardware Acceleration Flags

Current configuration in `main.ts`:

```typescript
// Core acceleration
app.commandLine.appendSwitch("enable-media-stream");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-accelerated-video");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("enable-native-gpu-memory-buffers");
app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-hardware-overlays");

// Platform-specific features
app.commandLine.appendSwitch("disable-features", "UseChromeOSDirectVideoDecoder");
app.commandLine.appendSwitch("enable-features", [
    "WaylandWindowDecorations",
    "AcceleratedVideoDecodeLinuxGL",
    "VaapiVideoDecoder",
    "AcceleratedVideoDecodeLinuxZeroCopyGL",
    "VaapiIgnoreDriverChecks",
    "Av1Decoder",
    "VaapiAV1Decoder",
    "GlobalVaapiLock",
    "PlatformHEVCDecoderSupport",
].join(","));
```

**Assessment:** Configuration is comprehensive and aligns with best practices for multi-platform hardware acceleration.

---

## 2. Codec Support Summary

### 2.1 GeForce NOW Codec Usage

| Tier | Resolution | Primary Codec | Fallback |
|------|------------|---------------|----------|
| Free | 1080p max | H.264 | - |
| Priority | 1440p | HEVC | H.264 |
| Ultimate | 4K | AV1 | HEVC |

### 2.2 Electron 37.2.0 Codec Matrix

| Codec | Software Decode | Hardware Decode | Status |
|-------|-----------------|-----------------|--------|
| H.264/AVC | Yes | Yes (all platforms) | ✅ Full Support |
| VP8/VP9 | Yes | Yes | ✅ Full Support |
| AV1 | Yes (dav1d) | Yes (with HW) | ✅ Full Support |
| HEVC | No | Yes (Electron 22+) | ⚠️ HW Only |
| AC3/E-AC3 | No | No | ❌ Not Included |

### 2.3 Hardware Requirements

**AV1 Hardware Decode:**
- NVIDIA RTX 30 series+
- AMD RX 6000 series+
- Intel 11th Gen+ / Arc
- Apple M3+

**HEVC Hardware Decode:**
- NVIDIA GTX 950+
- AMD RX 400 series+
- Intel 6th Gen+
- Apple M1+ (macOS 11.0+)

---

## 3. Hardware Acceleration Configuration

### 3.1 Linux (VAAPI)

**Driver Requirements:**
```bash
# Intel
sudo pacman -S intel-media-driver libva-utils

# AMD
sudo pacman -S libva-mesa-driver libva-utils

# NVIDIA (experimental wrapper)
sudo pacman -S libva-nvidia-driver
```

**NVIDIA Limitation:** Per crbug.com/1492880, NVIDIA VAAPI drivers have limited Chromium compatibility. The wrapper provides NVDEC access but may not support all features.

**Verification:**
```bash
vainfo  # Should show supported profiles including AV1
```

### 3.2 Windows (D3D11/DXVA)

**Requirements:**
- "HEVC Video Extensions" from Microsoft Store ($0.99)
- "AV1 Video Extension" (built into Windows 10 1909+)

**Verification:**
```powershell
Get-AppxPackage -Name *HEVC* | Select-Object Name, Version
Get-AppxPackage -Name *AV1* | Select-Object Name, Version
```

### 3.3 macOS (VideoToolbox)

**Requirements:**
- macOS 11.0+ (Big Sur) for HEVC
- macOS 13+ for AV1 on M3 hardware

**Features enabled:**
- PlatformHEVCDecoderSupport (flag in main.ts)

---

## 4. Custom Build Decision Matrix

### 4.1 When Custom Builds Are NOT Needed

| Requirement | Standard Electron Support | Action |
|-------------|---------------------------|--------|
| AV1 streaming | ✅ Full (SW + HW) | None required |
| HEVC streaming | ✅ Hardware decode | Ensure HW present |
| H.264 streaming | ✅ Full | None required |
| 4K resolution | ✅ Via resolution override | Already implemented |
| 120fps | ✅ Via resolution override | Already implemented |

### 4.2 When Custom Builds ARE Needed

| Requirement | Standard Support | Custom Build Benefit |
|-------------|------------------|---------------------|
| HEVC software decode | ❌ | Enables decode without HW |
| AC3/E-AC3 audio | ❌ | Enables Dolby Digital |
| Custom DRM | Limited | Full control |
| Proprietary codecs | Limited | FFmpeg patches |

### 4.3 Cost-Benefit Analysis

| Factor | Standard Electron | Custom Build |
|--------|-------------------|--------------|
| Build time | 0 (pre-built) | 2-4 hours |
| Disk space | ~200 MB | 50-100 GB |
| Maintenance | Minimal | High |
| Security updates | Automatic | Manual rebuild |
| Codec flexibility | Limited | Full |
| Legal risk | None | Varies |

**Conclusion:** For GeForce NOW streaming, standard Electron provides all required codec support. Custom builds add maintenance burden without proportional benefit.

---

## 5. Implementation Options

### 5.1 Option 1: Enhanced Configuration (CURRENT/RECOMMENDED)

**Status:** Implemented in v1.4.0

**Benefits:**
- Zero build overhead
- Automatic Electron updates
- Full hardware acceleration
- Working resolution override

**Limitations:**
- No software HEVC fallback
- Dependent on user hardware

### 5.2 Option 2: FFmpeg Library Replacement

**Approach:** Replace libffmpeg.so/dylib/dll with custom-built version

**Considerations:**
- Maintains Electron updates
- Enables additional codecs
- Legal gray area for HEVC
- Moderate maintenance burden

**Not Recommended** unless specific codec gaps identified.

### 5.3 Option 3: Full Custom Electron Build

**Approach:** Build Electron from source with modified configuration

**Requirements:**
- 50-100 GB disk space
- 2-4 hour build time per platform
- depot_tools setup
- GN/Ninja build system knowledge

**Not Recommended** for current requirements. Reserve for future if:
- GeForce NOW mandates unavailable codecs
- Major architectural changes needed
- Proprietary optimizations required

---

## 6. Diagnostics Feature Status

### 6.1 diag_panel Branch Overview

The `diag_panel` branch contains a complete diagnostics system implementation:

**Features:**
- GPU and codec capability detection
- Platform-specific checks (VAAPI, HEVC Extensions, VideoToolbox)
- WebCodecs API-based testing
- React UI with tabbed interface

**Files Added:**
```
src/electron/diagnostics/
├── index.ts           # Report generation
├── codec-detection.ts # WebCodecs detection
├── gpu-info.ts        # GPU information
├── platform-checks.ts # Platform checks
└── types.ts           # TypeScript types

src/overlay/components/
├── DiagnosticsPanel.tsx
└── diagnostics/
    ├── StatusIndicator.tsx
    └── TabButton.tsx
```

### 6.2 Merge Blocker

**Issue:** Sidebar toggle (Ctrl+I) functionality broken after diagnostics implementation

**Root Cause:** Preload script modifications interfered with existing IPC patterns

**Resolution Path:**
1. Isolate diagnostics preload from main preload
2. Use menu-based trigger instead of keyboard shortcut
3. Add comprehensive IPC testing

### 6.3 Documentation Ready for Merge

The following documentation from diag_panel should be merged to master:
- `docs/CUSTOM-ELECTRON-BUILD-PLAN.md`
- `docs/PLATFORM-REQUIREMENTS.md`

These provide valuable reference independent of UI implementation.

---

## 7. Roadmap and Recommendations

### 7.1 Immediate Actions (v1.5.0)

1. **Merge documentation** from diag_panel branch
2. **Create platform requirements guide** for users
3. **Add codec verification** to startup logging

### 7.2 Short-Term (v1.6.0)

1. **Diagnostics panel** - resolve sidebar toggle issue
2. **Driver detection** - warn about missing VAAPI/HEVC Extensions
3. **Enhanced logging** - codec selection visibility

### 7.3 Medium-Term (v2.0.0)

1. **WebCodecs integration** - modern codec API usage
2. **HDR support** - if GeForce NOW expands HDR streaming
3. **Performance analytics** - frame timing and quality metrics

### 7.4 Long-Term (Future)

1. **Custom build infrastructure** - CI/CD pipeline for automated builds
2. **Codec expansion** - if GeForce NOW requirements change
3. **VVC/H.266 preparation** - next-generation codec readiness

---

## 8. Appendix: Research Documents

Detailed research is available in `/docs/research/`:

| Document | Content |
|----------|---------|
| `electron-build-notes.md` | Build process, distribution methods, maintenance |
| `codec-support.md` | Codec deep-dive, patents, hardware requirements |
| `diag-panel-analysis.md` | Branch analysis, feature status, merge recommendations |

---

## Summary

GeForce Infinity v1.4.0 represents an optimally configured application for GeForce NOW streaming. The resolution override system works correctly, hardware acceleration is comprehensively enabled, and all required codecs are available through standard Electron.

**Custom Electron builds are not recommended** at this time. The maintenance burden and build complexity do not provide proportional benefit given:
1. AV1 is fully supported in standard builds
2. HEVC hardware decode is available
3. Resolution override system works as designed
4. External factors (GeForce NOW tiers) determine actual streaming capabilities

Future development should focus on:
1. User-facing diagnostics for troubleshooting
2. Documentation and guidance for platform setup
3. Monitoring GeForce NOW requirements for changes

This document should be reviewed if:
- GeForce NOW introduces new codec requirements
- Significant user feedback indicates codec gaps
- Electron removes or changes codec support
