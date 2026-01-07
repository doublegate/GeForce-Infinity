import { registerUpdaterHandlers } from "./updater.js";
import { registerUserSettingsHandlers } from "./userSettings.js";
import { registerSidebarIpcHandlers } from "./sidebar.js";
import { registerDiagnosticsHandlers } from "./diagnostics.js";

import type { AppContext } from "../types/context.js";

export function registerIpcHandlers(deps: AppContext) {
  registerUpdaterHandlers(deps);
  registerUserSettingsHandlers(deps);
  registerSidebarIpcHandlers(deps.mainWindow);
  registerDiagnosticsHandlers(deps);
}
