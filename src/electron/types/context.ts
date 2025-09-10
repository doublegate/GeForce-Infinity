import { BrowserWindow } from "electron";
import { Config } from "../../shared/types.js";

export interface AppContext {
    mainWindow: BrowserWindow;
    clientId: string;
    updateActivity: (gameTitle: string | null) => void;
    saveConfig: (updates: Partial<Config>) => void;
}
