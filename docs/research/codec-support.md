# Video Codec Support Research

**Date:** January 2026
**Project:** GeForce Infinity
**Focus:** AV1, HEVC, H.264, VP9 codec support for high-resolution streaming

---

## Executive Summary

This document provides comprehensive research on video codec support relevant to GeForce Infinity's goal of enabling high-resolution (3440x1440, 4K, 5K+) and high-framerate (120fps+) streaming through GeForce NOW.

**Key Findings:**
- AV1 is royalty-free and fully supported in standard Chromium/Electron
- HEVC hardware decoding available since Electron v22.0.0
- GeForce NOW uses codec selection based on resolution and subscription tier
- No custom builds needed for standard AV1/HEVC hardware acceleration

---

## 1. Codec Overview

### Comparison Matrix

| Codec | Standard | Year | Licensing | Compression | Use Case |
|-------|----------|------|-----------|-------------|----------|
| H.264/AVC | ITU-T | 2003 | MPEG LA (paid) | Good | Legacy, wide support |
| HEVC/H.265 | ITU-T | 2013 | Complex (3 pools) | ~40% better | 4K, HDR |
| VP9 | Google | 2013 | Royalty-free | ~40% better | YouTube, web |
| AV1 | AOMedia | 2018 | Royalty-free | ~30% better | Future standard |

### Codec Efficiency Ladder

```
Compression Efficiency (approximate bitrate savings vs H.264):

AV1      ████████████████████████████████████████ +50%
HEVC     ████████████████████████████████ +40%
VP9      ████████████████████████████████ +40%
H.264    ████████████████████████ (baseline)
```

---

## 2. Patent and Licensing Landscape

### H.264/AVC

- **Patent Pool:** MPEG LA
- **Status:** Base patents expiring (started 2023)
- **Cost:** Royalty-free for free internet video; fees for commercial distribution
- **Risk:** Low - widely used and well-understood

### HEVC/H.265

- **Patent Pools:** Three separate pools
  - MPEG LA
  - HEVC Advance
  - Velos Media
- **Status:** Complex, some patent holders outside pools
- **Cost:** Higher than H.264, fragmented
- **Risk:** Medium-High - licensing complexity slowed adoption

### AV1

- **Organization:** Alliance for Open Media (AOMedia)
- **Members:** Google, Apple, Microsoft, Netflix, Amazon, Meta, Intel, AMD, NVIDIA
- **Status:** Royalty-free by design
- **Cost:** None - cross-licensing among members, no assertions against implementations
- **Risk:** None - designed specifically to avoid HEVC patent issues

**Strategic Implication:** AV1 is the preferred codec for new implementations due to zero licensing risk.

---

## 3. Chromium/Electron Codec Support

### Built-in Codecs (Electron 37.2.0)

| Codec | Software Decode | Hardware Decode | Notes |
|-------|-----------------|-----------------|-------|
| H.264/AVC | Yes | Yes (all platforms) | Requires proprietary_codecs=true |
| VP8 | Yes | Yes | Fully open source |
| VP9 | Yes | Yes | Google's predecessor to AV1 |
| AV1 | Yes (dav1d/libgav1) | Yes (with HW) | Fully included since Chrome 69 |
| HEVC | No (without patches) | Yes (Electron 22+) | HW only in standard builds |

### AV1 Decoder Implementation

Chromium includes two AV1 software decoders:
1. **libgav1:** Google's native implementation
2. **dav1d:** VideoLAN's high-performance decoder

Hardware acceleration routes through platform APIs:
- Linux: VAAPI
- Windows: DXVA/D3D11
- macOS: VideoToolbox

### HEVC Implementation

**Hardware Decoding (Available):**
- Windows: D3D11VideoDecoder (requires HEVC Extensions)
- Linux: VAAPI (Intel, AMD drivers)
- macOS: VideoToolbox (Big Sur 11.0+)

**Software Decoding (Not Available):**
- Requires FFmpeg patches
- MPEG-LA licensing concerns
- Community projects like electron-chromium-codecs exist

---

## 4. GeForce NOW Codec Usage

### Codec Selection by Tier and Resolution

| Tier | Resolution | Primary Codec | Fallback |
|------|------------|---------------|----------|
| Free | 1080p max | H.264 | - |
| Priority | 1440p | HEVC | H.264 |
| Ultimate | 4K | AV1 | HEVC |

### Client Detection Flow

```
GeForce NOW Server
      │
      ▼
┌─────────────────┐
│ Check Tier      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Client    │
│ HW Capabilities │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Select Optimal  │
│ Codec/Resolution│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Begin Stream    │
└─────────────────┘
```

### Transcoding Behavior

GeForce NOW may transcode streams for compatibility:
- Non-Shield devices may receive HEVC transcoded to H.264
- This maintains compatibility but reduces quality
- Shield devices receive native codec streams

---

## 5. Hardware Acceleration Requirements

### GPU Codec Support Matrix

#### NVIDIA

| GPU Series | H.264 | HEVC | VP9 | AV1 Decode | AV1 Encode |
|------------|-------|------|-----|------------|------------|
| RTX 40 | Yes | Yes | Yes | Yes | Yes |
| RTX 30 | Yes | Yes | Yes | Yes | No |
| RTX 20 | Yes | Yes | Yes | No | No |
| GTX 16 | Yes | Yes | Yes | No | No |
| GTX 10 | Yes | Yes | No | No | No |

#### AMD

| GPU Series | H.264 | HEVC | VP9 | AV1 Decode | AV1 Encode |
|------------|-------|------|-----|------------|------------|
| RX 7000 (RDNA 3) | Yes | Yes | Yes | Yes | Yes |
| RX 6000 (RDNA 2) | Yes | Yes | Yes | Yes | No |
| RX 5000 (RDNA 1) | Yes | Yes | Yes | No | No |
| RX 400/500 | Yes | Yes | Yes | No | No |

#### Intel

| GPU Generation | H.264 | HEVC | VP9 | AV1 Decode | AV1 Encode |
|----------------|-------|------|-----|------------|------------|
| Arc A-series | Yes | Yes | Yes | Yes | Yes |
| 12th Gen+ | Yes | Yes | Yes | Yes | Yes |
| 11th Gen | Yes | Yes | Yes | Yes | No |
| 9th-10th Gen | Yes | Yes | Yes | No | No |

#### Apple Silicon

| Chip | H.264 | HEVC | VP9 | AV1 Decode | AV1 Encode |
|------|-------|------|-----|------------|------------|
| M3/M3 Pro/Max | Yes | Yes | Yes | Yes | No |
| M2/M2 Pro/Max | Yes | Yes | Yes | No | No |
| M1/M1 Pro/Max | Yes | Yes | Yes | No | No |

---

## 6. Platform-Specific Configuration

### Linux (VAAPI)

```bash
# Enable hardware acceleration flags
--enable-features=VaapiVideoDecoder,VaapiAV1Decoder,VaapiIgnoreDriverChecks,AcceleratedVideoDecodeLinuxGL

# Disable Chrome OS specific decoder (causes issues on desktop Linux)
--disable-features=UseChromeOSDirectVideoDecoder

# Use appropriate GL backend
--use-gl=egl  # or --use-gl=angle --use-angle=gl
```

**Driver Requirements:**
- Intel: `intel-media-driver` (iHD) for 6th gen+
- AMD: `mesa-va-drivers` (radeonsi backend)
- NVIDIA: `libva-nvidia-driver` (NVDEC wrapper, experimental)

**NVIDIA VAAPI Limitation:** Per Chromium bug crbug.com/1492880, NVIDIA VA-API drivers are not fully compatible with Chromium despite VaapiOnNvidiaGPUs flag existence.

### Windows (D3D11/DXVA)

```bash
# D3D11 video decoder (default, but can be forced)
--enable-features=D3D11VideoDecodeAcceleration

# Force D3D11 if driver workarounds disable it
--disable-gpu-driver-bug-workarounds --enable-features=D3D11VideoDecoder
```

**Requirements:**
- HEVC: "HEVC Video Extensions" from Microsoft Store ($0.99)
- AV1: Built into Windows 10 1909+ / Windows 11

### macOS (VideoToolbox)

```bash
# Enable platform HEVC support
--enable-features=PlatformHEVCDecoderSupport

# VP9 hardware decoding (if supported)
--enable-features=VideoToolboxVP9Decoding

# AV1 on M3+ (may require explicit flag)
--enable-features=VideoToolboxAV1Decoding
```

**Requirements:**
- macOS 11.0+ (Big Sur) for HEVC
- macOS 13+ for AV1 on M3 hardware

---

## 7. Verification Methods

### Chrome Internal Pages

1. **chrome://gpu** - GPU feature status and capabilities
2. **chrome://media-internals** - Active decoder information

### Expected Decoder Types

| Status | Decoder Shown | Meaning |
|--------|---------------|---------|
| HW Accelerated | VDAVideoDecoder, GpuVideoDecoder, D3D11VideoDecoder, VideoToolboxVideoDecoder | Working |
| Software | FFmpegVideoDecoder, VpxVideoDecoder, Dav1dVideoDecoder | Fallback |

### Linux VAAPI Check

```bash
# Check available VAAPI profiles
vainfo

# Expected for AV1 support:
# VAProfileAV1Profile0 : VAEntrypointVLD
```

---

## 8. Implications for GeForce Infinity

### Current Implementation Assessment

GeForce Infinity v1.4.0+ already implements comprehensive hardware acceleration flags in `main.ts`:

```typescript
app.commandLine.appendSwitch(
  "enable-features",
  [
    "VaapiVideoDecoder",
    "Av1Decoder",
    "VaapiAV1Decoder",
    "PlatformHEVCDecoderSupport",
    "AcceleratedVideoDecodeLinuxGL",
    // ... additional flags
  ].join(","),
);
```

### No Custom Build Required Because:

1. **AV1 is included** in standard Electron with both software (dav1d) and hardware support
2. **HEVC hardware decoding** available since Electron v22.0.0
3. **Platform APIs** (VAAPI, D3D11, VideoToolbox) properly configured via flags
4. **GeForce NOW server** makes ultimate codec decisions based on tier and client capabilities

### Potential Enhancement Areas

1. **Diagnostics panel:** Help users verify codec/acceleration status
2. **Driver detection:** Warn users about missing VAAPI drivers on Linux
3. **HEVC Extensions check:** Detect missing Windows extension
4. **Fallback guidance:** When hardware decode unavailable, suggest upgrades

---

## 9. Future Considerations

### Emerging Codecs

- **VVC/H.266:** Next-generation ITU codec (2020), not yet widely adopted
- **LCEVC:** Enhancement layer for existing codecs
- **AV2:** In development by AOMedia

### GeForce NOW Roadmap

NVIDIA continues to enhance GeForce NOW with:
- Broader AV1 deployment
- Higher resolution support (8K potential)
- Lower latency optimizations

### Electron/Chromium Updates

Monitor for:
- New hardware decoder integrations
- Improved NVIDIA Linux support
- Additional codec feature flags
