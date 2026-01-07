# Platform Requirements for GeForce Infinity

**Document Version:** 1.0.0
**Created:** January 2026
**Project:** GeForce Infinity v1.5.0+

---

## Overview

This document outlines the platform-specific requirements for optimal codec support in GeForce Infinity. Proper hardware acceleration setup is essential for high-quality streaming at 1440p, 4K, and beyond.

---

## Quick Reference

| Platform | AV1 Support | HEVC Support | Key Requirements |
|----------|-------------|--------------|------------------|
| **Linux** | VAAPI required | VAAPI required | Install GPU-specific VAAPI driver |
| **Windows** | Native (modern GPUs) | HEVC Extensions | Install from Microsoft Store |
| **macOS** | VideoToolbox (M1+) | VideoToolbox | macOS Big Sur (11.0)+ |

---

## Linux Requirements

### VAAPI (Video Acceleration API)

VAAPI is required for hardware-accelerated video decoding on Linux. Without it, video decoding falls back to software, which increases CPU usage and reduces quality.

#### Intel GPUs

**Recommended Driver:** `intel-media-driver` (iHD)

```bash
# Ubuntu/Debian
sudo apt install intel-media-va-driver-non-free vainfo

# Fedora
sudo dnf install intel-media-driver libva-utils

# Arch Linux
sudo pacman -S intel-media-driver libva-utils
```

**Supported Codecs:**
- **Intel Arc (DG2):** AV1, HEVC, H.264, VP9 (all hardware accelerated)
- **Intel 11th Gen+ (Tiger Lake):** AV1 decode, HEVC, H.264, VP9
- **Intel 6th-10th Gen:** HEVC, H.264, VP9 (no AV1)
- **Intel 5th Gen and older:** H.264 only

#### AMD GPUs

**Recommended Driver:** `libva-mesa-driver` (radeonsi)

```bash
# Ubuntu/Debian
sudo apt install mesa-va-drivers vainfo

# Fedora
sudo dnf install mesa-va-drivers libva-utils

# Arch Linux
sudo pacman -S libva-mesa-driver libva-utils
```

**Supported Codecs:**
- **RX 7000 series (RDNA 3):** AV1, HEVC, H.264, VP9
- **RX 6000 series (RDNA 2):** AV1 decode, HEVC, H.264, VP9
- **RX 5000 series (RDNA 1):** HEVC, H.264, VP9
- **RX 400/500 series (Polaris):** HEVC, H.264, VP9

#### NVIDIA GPUs

**Recommended Driver:** `libva-nvidia-driver` (experimental NVDEC wrapper)

```bash
# Ubuntu/Debian (requires PPA or manual build)
# Not in official repositories - see GitHub for installation

# Fedora
sudo dnf install libva-nvidia-driver

# Arch Linux
sudo pacman -S libva-nvidia-driver
```

**Note:** NVIDIA's VAAPI support is provided through a wrapper around NVDEC. Native VAAPI is not supported; use the `nvidia-vaapi-driver` package.

**Supported Codecs:**
- **RTX 40 series:** AV1 encode/decode, HEVC, H.264, VP9
- **RTX 30 series:** AV1 decode, HEVC, H.264, VP9
- **RTX 20 series / GTX 16 series:** HEVC, H.264, VP9
- **GTX 10 series and older:** HEVC, H.264

### Verifying VAAPI Installation

Run `vainfo` to check VAAPI support:

```bash
vainfo
```

**Expected output (example for Intel Arc):**
```
libva info: VA-API version 1.18.0
libva info: Trying to open /usr/lib/dri/iHD_drv_video.so
libva info: Found init function __vaDriverInit_1_18
libva info: va_openDriver() returns 0
vainfo: VA-API version: 1.18 (libva 2.18.0)
vainfo: Driver version: Intel iHD driver for Intel(R) Gen Graphics - 23.3.0
vainfo: Supported profile and entrypoints
      VAProfileAV1Profile0            :	VAEntrypointVLD
      VAProfileHEVCMain               :	VAEntrypointVLD
      VAProfileH264Main               :	VAEntrypointVLD
      ...
```

### Linux Chromium Flags

GeForce Infinity automatically sets these flags, but for reference:

```
--enable-features=VaapiVideoDecoder,VaapiAV1Decoder,VaapiIgnoreDriverChecks
--use-gl=egl
```

### Wayland Considerations

On Wayland sessions, ensure:
1. XWayland is available for full compatibility
2. The `WaylandWindowDecorations` feature is enabled (automatic in GeForce Infinity)

---

## Windows Requirements

### HEVC Video Extensions

Windows requires the "HEVC Video Extensions" package for HEVC/H.265 hardware decoding.

#### Installation Options

**Option 1: Microsoft Store (Paid - $0.99)**
1. Open Microsoft Store
2. Search for "HEVC Video Extensions"
3. Purchase and install

**Option 2: Device Manufacturer (Free)**
1. Search for "HEVC Video Extensions from Device Manufacturer"
2. Install if available for your device

**Option 3: Manual Installation**
For enterprise deployments, the extension can be sideloaded using DISM or PowerShell.

### Verifying HEVC Installation

```powershell
# PowerShell command to check HEVC installation
Get-AppxPackage -Name *HEVC* | Select-Object Name, Version
```

### AV1 Support

AV1 support is built into Windows 10 (version 1909+) and Windows 11. The "AV1 Video Extension" is installed by default on modern Windows versions.

**Verify AV1 support:**
```powershell
Get-AppxPackage -Name *AV1* | Select-Object Name, Version
```

### GPU Driver Requirements

| GPU Vendor | Minimum Driver | Recommended |
|------------|----------------|-------------|
| NVIDIA | 471.11+ | Latest Game Ready Driver |
| AMD | 21.12.1+ | Latest Adrenalin Driver |
| Intel | 30.0.101.1330+ | Latest Arc/Graphics Driver |

### Windows Hardware Acceleration

Windows uses Direct3D 11/12 Video Decoder for hardware acceleration. GeForce Infinity automatically configures:

```
--enable-features=D3D11VideoDecodeAcceleration
--enable-d3d11-video-decoder
```

---

## macOS Requirements

### VideoToolbox

macOS uses VideoToolbox for hardware-accelerated video decoding. It's built into the operating system and requires no additional installation.

### macOS Version Requirements

| macOS Version | Codec Support |
|---------------|---------------|
| macOS 14 (Sonoma)+ | AV1, HEVC, H.264, VP9 |
| macOS 13 (Ventura) | AV1 (M1/M2), HEVC, H.264, VP9 |
| macOS 12 (Monterey) | HEVC, H.264, VP9 |
| macOS 11 (Big Sur) | HEVC, H.264, VP9 |
| macOS 10.15 (Catalina) | HEVC (limited), H.264 |

### Apple Silicon vs Intel

**Apple Silicon (M1/M2/M3):**
- Full AV1 hardware decode support
- Excellent HEVC performance
- Native VideoToolbox integration

**Intel Macs:**
- No AV1 hardware decode
- HEVC support via T2 chip (2018+ models)
- iGPU-based hardware acceleration

### Verifying VideoToolbox

VideoToolbox is always available on macOS. To verify codec support:

```bash
# Check system profiler for GPU info
system_profiler SPDisplaysDataType
```

---

## GPU Codec Support Matrix

### NVIDIA GPUs

| GPU | AV1 Decode | AV1 Encode | HEVC Decode | HEVC Encode |
|-----|------------|------------|-------------|-------------|
| RTX 40 series | Yes | Yes | Yes | Yes |
| RTX 30 series | Yes | No | Yes | Yes |
| RTX 20 series | No | No | Yes | Yes |
| GTX 16 series | No | No | Yes | Yes |
| GTX 10 series | No | No | Yes | No |

### AMD GPUs

| GPU | AV1 Decode | AV1 Encode | HEVC Decode | HEVC Encode |
|-----|------------|------------|-------------|-------------|
| RX 7000 (RDNA 3) | Yes | Yes | Yes | Yes |
| RX 6000 (RDNA 2) | Yes | No | Yes | Yes |
| RX 5000 (RDNA 1) | No | No | Yes | Yes |
| RX 500/400 | No | No | Yes | No |

### Intel GPUs

| GPU | AV1 Decode | AV1 Encode | HEVC Decode | HEVC Encode |
|-----|------------|------------|-------------|-------------|
| Arc A-series | Yes | Yes | Yes | Yes |
| 12th Gen+ | Yes | Yes | Yes | Yes |
| 11th Gen (iGPU) | Yes | No | Yes | Yes |
| 10th Gen (iGPU) | No | No | Yes | Yes |
| 6th-9th Gen | No | No | Yes | No |

---

## GeForce NOW Codec Usage

GeForce NOW selects codecs based on resolution and subscription tier:

| Resolution | Free Tier | Priority | Ultimate |
|------------|-----------|----------|----------|
| 1080p | H.264 | H.264/HEVC | H.264/HEVC |
| 1440p | N/A | HEVC | HEVC/AV1 |
| 4K | N/A | N/A | HEVC/AV1 |

### Codec Selection Priority

1. **AV1** - Preferred for 4K (Ultimate tier, compatible hardware)
2. **HEVC** - Primary codec for 1440p+
3. **H.264** - Fallback for maximum compatibility

---

## Troubleshooting

### Linux

**Problem:** VAAPI not detected
- Ensure appropriate driver is installed (`vainfo` should show profiles)
- Check render node permissions: `ls -la /dev/dri/renderD*`
- Add user to `video` and `render` groups

**Problem:** AV1 not supported
- Verify GPU supports AV1 (Intel 11th Gen+, AMD RX 6000+, NVIDIA RTX 30+)
- Update GPU drivers to latest version
- Check VAAPI profiles include `VAProfileAV1Profile0`

### Windows

**Problem:** HEVC not working
- Install HEVC Video Extensions from Microsoft Store
- Update GPU drivers
- Check Windows version (1903+ required)

**Problem:** AV1 not working
- Verify AV1 Video Extension is installed
- Ensure GPU supports AV1 hardware decode
- Update to Windows 10 1909+ or Windows 11

### macOS

**Problem:** Poor video quality
- Update to latest macOS version
- Ensure hardware acceleration is enabled in system settings
- For Intel Macs, check if T2 chip is present

---

## Using the Diagnostics Panel

GeForce Infinity includes a built-in diagnostics panel accessible via the sidebar (Ctrl+I):

1. Open the sidebar
2. Expand the "System Diagnostics" section
3. View codec support status
4. Run codec tests to verify functionality
5. Check GPU and platform information

The diagnostics panel provides:
- Real-time codec capability detection
- GPU hardware acceleration status
- Platform-specific recommendations
- Comprehensive test results

---

## Additional Resources

### Official Documentation
- [Chromium VAAPI Documentation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/vaapi.md)
- [Electron Hardware Acceleration](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering)
- [GeForce NOW System Requirements](https://www.nvidia.com/en-us/geforce-now/system-reqs/)

### Community Resources
- [Arch Wiki - Hardware Video Acceleration](https://wiki.archlinux.org/title/Hardware_video_acceleration)
- [Arch Wiki - Chromium](https://wiki.archlinux.org/title/Chromium)

---

**Document Maintained By:** GeForce Infinity Development Team
**Last Updated:** January 2026
