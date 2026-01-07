import { describe, it, expect } from "vitest";
import { tryPatchBody } from "../src/electron/network/interceptor";
import type { Config } from "../src/shared/types";

// Mock config for testing
const mockConfig: Config = {
  monitorWidth: 3440,
  monitorHeight: 1440,
  framesPerSecond: 120,
  codecPreference: "av1",
  rpcEnabled: false,
  automute: false,
  autofocus: false,
  notify: false,
  inactivityNotification: false,
  informed: true,
  accentColor: "#76b900",
};

describe("tryPatchBody", () => {
  it("returns undefined for empty input", () => {
    expect(tryPatchBody("", mockConfig)).toBeUndefined();
  });

  it("returns undefined for non-JSON input", () => {
    expect(tryPatchBody("not json", mockConfig)).toBeUndefined();
  });

  it("returns undefined for JSON without sessionRequestData", () => {
    const input = JSON.stringify({ foo: "bar" });
    expect(tryPatchBody(input, mockConfig)).toBeUndefined();
  });

  it("returns undefined for JSON without clientRequestMonitorSettings", () => {
    const input = JSON.stringify({ sessionRequestData: { foo: "bar" } });
    expect(tryPatchBody(input, mockConfig)).toBeUndefined();
  });

  it("patches resolution settings correctly", () => {
    const input = JSON.stringify({
      sessionRequestData: {
        clientRequestMonitorSettings: [
          {
            widthInPixels: 1920,
            heightInPixels: 1080,
            framesPerSecond: 60,
          },
        ],
      },
    });

    const result = tryPatchBody(input, mockConfig);
    expect(result).toBeDefined();

    const parsed = JSON.parse(result!);
    const settings = parsed.sessionRequestData.clientRequestMonitorSettings[0];

    expect(settings.widthInPixels).toBe(3440);
    expect(settings.heightInPixels).toBe(1440);
    expect(settings.framesPerSecond).toBe(120);
  });

  it("calculates correct DPI for 1440p resolution", () => {
    const input = JSON.stringify({
      sessionRequestData: {
        clientRequestMonitorSettings: [{}],
      },
    });

    const result = tryPatchBody(input, mockConfig);
    const parsed = JSON.parse(result!);
    const settings = parsed.sessionRequestData.clientRequestMonitorSettings[0];

    expect(settings.dpi).toBe(144); // 1440p should get 144 DPI
  });

  it("calculates correct DPI for 4K resolution", () => {
    const config4K: Config = {
      ...mockConfig,
      monitorWidth: 3840,
      monitorHeight: 2160,
    };

    const input = JSON.stringify({
      sessionRequestData: {
        clientRequestMonitorSettings: [{}],
      },
    });

    const result = tryPatchBody(input, config4K);
    const parsed = JSON.parse(result!);
    const settings = parsed.sessionRequestData.clientRequestMonitorSettings[0];

    expect(settings.dpi).toBe(192); // 4K should get 192 DPI
  });

  it("calculates correct DPI for 1080p resolution", () => {
    const config1080p: Config = {
      ...mockConfig,
      monitorWidth: 1920,
      monitorHeight: 1080,
    };

    const input = JSON.stringify({
      sessionRequestData: {
        clientRequestMonitorSettings: [{}],
      },
    });

    const result = tryPatchBody(input, config1080p);
    const parsed = JSON.parse(result!);
    const settings = parsed.sessionRequestData.clientRequestMonitorSettings[0];

    expect(settings.dpi).toBe(96); // 1080p should get 96 DPI
  });
});
