# Platform Requirements Guide

**Version:** 1.5.7
**Date:** 2026-01-08

This guide covers system requirements, codec support, and troubleshooting for GeForce Infinity across all supported platforms.

---

## Table of Contents

1. [Minimum System Requirements](#minimum-system-requirements)
2. [GPU Requirements for Hardware Decoding](#gpu-requirements-for-hardware-decoding)
3. [GeForce NOW Tier Requirements](#geforce-now-tier-requirements)
4. [Platform-Specific Setup](#platform-specific-setup)
5. [Codec Support Matrix](#codec-support-matrix)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## Minimum System Requirements

### All Platforms

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | Dual-core 2.0 GHz | Quad-core 3.0 GHz |
| RAM | 4 GB | 8 GB |
| Network | 15 Mbps download | 50+ Mbps download |
| Display | 1280x720 | 1920x1080 or higher |

### Linux

| Component | Requirement |
|-----------|-------------|
| Distribution | Ubuntu 20.04+, Fedora 35+, Arch Linux, or equivalent |
| Display Server | X11 or Wayland |
| Graphics Driver | Mesa 21.0+ (AMD/Intel) or NVIDIA 470+ |
| VA-API | Required for hardware video decoding |

### macOS

| Component | Requirement |
|-----------|-------------|
| Version | macOS 11 (Big Sur) or later |
| Chip | Intel or Apple Silicon (M1/M2/M3) |
| VideoToolbox | Built-in (system requirement) |

### Windows

| Component | Requirement |
|-----------|-------------|
| Version | Windows 10 1903+ or Windows 11 |
| DirectX | DirectX 11+ |
| Visual C++ Runtime | 2019 or later |

---

## GPU Requirements for Hardware Decoding

Hardware video decoding is essential for smooth 4K and high-framerate streaming. The following GPUs support the required codecs:

### AV1 Hardware Decoding

AV1 is the preferred codec for 4K streaming due to its superior compression efficiency.

| Vendor | GPU Series | Notes |
|--------|------------|-------|
| **NVIDIA** | RTX 30-series (Ampere) or newer | RTX 3050, 3060, 3070, 3080, 3090 |
| **AMD** | RX 6000-series (RDNA2) or newer | RX 6600, 6700, 6800, 6900 |
| **Intel** | Arc A-series (Alchemist) | A380, A580, A750, A770 |
| **Apple** | M3 series | M3, M3 Pro, M3 Max (native support) |

### HEVC/H.265 Hardware Decoding

| Vendor | GPU Series | Notes |
|--------|------------|-------|
| **NVIDIA** | GTX 950+ or Maxwell (GM206+) | Most modern NVIDIA GPUs |
| **AMD** | RX 400-series (Polaris) or newer | Good support across modern lineup |
| **Intel** | 6th Gen Core (Skylake) or newer | Built into Intel HD/UHD/Iris graphics |
| **Apple** | Intel Macs with T2 chip, all Apple Silicon | Native support |

### VP9 Hardware Decoding

| Vendor | GPU Series | Notes |
|--------|------------|-------|
| **NVIDIA** | GTX 950+ | Widely supported |
| **AMD** | RX 400-series or newer | Good support |
| **Intel** | 7th Gen Core (Kaby Lake) or newer | Native support |
| **Apple** | All Apple Silicon, Intel with T2 | Native support |

---

## GeForce NOW Tier Requirements

GeForce NOW has different tiers that affect available resolutions and streaming quality:

| Feature | Free | Priority | Ultimate |
|---------|------|----------|----------|
| Max Resolution | 1080p | 1080p | 4K |
| Max Framerate | 60 FPS | 60 FPS | 120 FPS |
| RTX (Ray Tracing) | No | Yes | Yes |
| Session Length | 1 hour | 6 hours | 8 hours |
| Queue Priority | Standard | Priority | Priority |

### Resolution Override Notes

GeForce Infinity can override resolution settings sent to GeForce NOW servers, but:

1. **Account Tier Limits Apply**: Even with override, 4K requires Ultimate tier
2. **Game-Specific Restrictions**: Some games cap resolution regardless of settings
3. **Server Availability**: 4K servers may have limited availability
4. **Network Requirements**: 4K streaming requires 40+ Mbps stable connection

---

## Platform-Specific Setup

### Linux

#### Installing VA-API Drivers

**Ubuntu/Debian (AMD):**
```bash
sudo apt install mesa-va-drivers libva-mesa-driver
```

**Ubuntu/Debian (Intel):**
```bash
sudo apt install intel-media-va-driver
# or for older systems:
sudo apt install i965-va-driver
```

**Ubuntu/Debian (NVIDIA):**
```bash
# NVIDIA doesn't natively support VA-API
# Use nvidia-vaapi-driver for RTX 30-series and newer:
sudo apt install nvidia-vaapi-driver
```

**Fedora (AMD/Intel):**
```bash
sudo dnf install mesa-va-drivers libva-intel-driver
```

**Arch Linux:**
```bash
# AMD
sudo pacman -S libva-mesa-driver mesa-vdpau

# Intel
sudo pacman -S intel-media-driver
# or: sudo pacman -S libva-intel-driver

# NVIDIA (RTX 30+)
yay -S nvidia-vaapi-driver
```

#### Verifying VA-API Support

```bash
# Install vainfo
sudo apt install vainfo  # Debian/Ubuntu
sudo dnf install libva-utils  # Fedora
sudo pacman -S libva-utils  # Arch

# Check VA-API support
vainfo
```

Expected output should show supported profiles including:
- `VAProfileH264High` (H.264)
- `VAProfileHEVCMain` (HEVC/H.265)
- `VAProfileVP9Profile0` (VP9)
- `VAProfileAV1Profile0` (AV1) - if supported

### macOS

macOS uses VideoToolbox for hardware video decoding. No additional setup is required.

**Verifying codec support:**
1. Open Terminal
2. Run: `system_profiler SPDisplaysDataType`
3. Check your GPU model against the compatibility tables above

**Apple Silicon Notes:**
- M1/M2: Native HEVC and VP9 decode, AV1 via software
- M3: Native AV1, HEVC, VP9 decode

### Windows

#### Checking Hardware Decode Support

1. Open **Task Manager** (Ctrl+Shift+Esc)
2. Go to **Performance** tab
3. Select your **GPU**
4. Look for "Video Decode" activity during streaming

#### Installing Required Codecs

Windows 10/11 include HEVC support, but you may need:

**HEVC Video Extensions** (if not pre-installed):
- Available from Microsoft Store
- May require purchase for non-OEM installations

**AV1 Video Extension**:
- Free from Microsoft Store
- Required for AV1 software decoding fallback

#### NVIDIA-Specific Setup

1. Install latest GeForce Game Ready Driver
2. Open NVIDIA Control Panel
3. Go to "Manage 3D Settings"
4. Ensure "Power management mode" is set to "Prefer maximum performance"

---

## Codec Support Matrix

GeForce Infinity enables the following codecs via Electron command-line switches:

| Codec | Switch/Feature | Linux | macOS | Windows |
|-------|----------------|-------|-------|---------|
| AV1 | `Av1Decoder`, `VaapiAV1Decoder` | VA-API | VideoToolbox | DXVA2 |
| HEVC | `PlatformHEVCDecoderSupport` | VA-API | VideoToolbox | DXVA2 |
| VP9 | Native Chromium | VA-API | VideoToolbox | DXVA2 |
| H.264 | Native Chromium | VA-API | VideoToolbox | DXVA2 |

### Enabled Chromium Features

GeForce Infinity enables these features for optimal codec support:

```
--enable-features=WaylandWindowDecorations,AcceleratedVideoDecodeLinuxGL,
                  VaapiVideoDecoder,AcceleratedVideoDecodeLinuxZeroCopyGL,
                  VaapiIgnoreDriverChecks,Av1Decoder,VaapiAV1Decoder,
                  GlobalVaapiLock,PlatformHEVCDecoderSupport
```

---

## Troubleshooting Guide

### Codec/Resolution Issues

#### "Higher resolutions not available"

**Possible causes:**
1. GeForce NOW account tier doesn't support higher resolutions
2. Game has resolution restrictions
3. GeForce NOW server limitations

**Solutions:**
1. Verify your GeForce NOW subscription tier
2. Check if the specific game supports higher resolutions
3. Try at different times when servers are less loaded

#### "Video stuttering or artifacts"

**Possible causes:**
1. Hardware decoding not working
2. Network bandwidth insufficient
3. GPU drivers outdated

**Solutions:**

*Linux:*
```bash
# Check if VA-API is working
vainfo

# Verify driver version
glxinfo | grep "OpenGL version"
```

*Windows:*
1. Update GPU drivers
2. Check Task Manager > GPU for "Video Decode" activity
3. Install AV1/HEVC extensions from Microsoft Store

*macOS:*
1. Check Activity Monitor for "VideoToolbox" process
2. Update to latest macOS version

#### "AV1 not working"

1. Verify your GPU supports AV1 (see tables above)
2. Check startup logs for codec status:
   ```
   ========================================
   GeForce Infinity - Codec Support Status
   ========================================
   ```
3. Ensure drivers are up to date

### Sidebar Toggle Issues

#### "Ctrl+I doesn't open sidebar"

**Solution:** As of v1.5.7, GeForce Infinity uses the `before-input-event` API to intercept keyboard shortcuts at the main process level. This should work regardless of which element has focus.

If the sidebar still doesn't toggle:
1. Check console for `[Shortcuts] Sidebar toggle triggered` message
2. Verify the overlay script loaded (check for "Overlay script loaded successfully")
3. Try restarting the application

### Checking Startup Logs

GeForce Infinity outputs detailed codec support information at startup. To view:

**Linux/macOS:**
```bash
# Run from terminal to see output
./path/to/GeForceInfinity.AppImage  # Linux
open /Applications/GeForce\ Infinity.app --args 2>&1 | less  # macOS
```

**Windows:**
1. Open Command Prompt
2. Navigate to installation directory
3. Run: `GeForceInfinity.exe`
4. Check output for codec status

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "GPU process crashed" | Driver issue | Update GPU drivers |
| "Video decode failed" | Missing codec support | Install VA-API drivers (Linux) or codec extensions (Windows) |
| "Network error" | Connection issue | Check network, try wired connection |
| "Session timeout" | Inactivity | Move mouse or enable inactivity notifications |

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check startup logs** for codec support status
2. **Review GitHub Issues** for similar problems
3. **Create a new issue** with:
   - Operating system and version
   - GPU model and driver version
   - GeForce NOW subscription tier
   - Startup log output (codec status section)
   - Steps to reproduce the issue

---

## Appendix: Verifying Codec Support

### Quick Test Procedure

1. Start GeForce Infinity
2. Check console output for "Codec Support Status" section
3. Launch a game on GeForce NOW
4. In sidebar, set desired resolution (e.g., 3440x1440)
5. Start a streaming session
6. Check logs for "Resolution override applied" message

### Expected Log Output

```
========================================
GeForce Infinity - Codec Support Status
========================================
Platform: linux
Electron: 37.2.0
Chrome: 128.0.6613.138

--- Hardware Acceleration ---
GPU Feature Status:
  gpu_compositing: enabled
  video_decode: enabled

--- Codec-Related Command Line Switches ---
  --enable-features=VaapiVideoDecoder,Av1Decoder,VaapiAV1Decoder,...

--- Expected Codec Support ---
  AV1:  Enabled via Av1Decoder, VaapiAV1Decoder flags
  HEVC: Enabled via PlatformHEVCDecoderSupport flag
  VP9:  Standard Chromium support
  H.264: Standard Chromium support
========================================
```

If "video_decode" shows as "disabled" or "software", hardware decoding is not working and you should check your GPU drivers.
