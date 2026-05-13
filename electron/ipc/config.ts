import { ipcMain } from 'electron';
import {
    loadConfig, saveConfig,
    TAGS_PATH, FAVORITES_PATH, NOTES_PATH, VCS_PREFS_PATH,
    readJsonFile, writeJsonFile
} from '../services/configStore';

export type VcsState = 'on' | 'off';
export interface ProjectVcsPref {
    git?: VcsState;
    diversion?: VcsState;
}

export function registerConfigHandlers() {
    ipcMain.handle('get-config-paths', async () => {
        const config = await loadConfig();
        return { enginePaths: config.enginePaths, projectPaths: config.projectPaths };
    });

    ipcMain.handle('remove-path', async (_, type: 'engine' | 'project', pathToRemove: string) => {
        const config = await loadConfig();
        if (type === 'engine') {
            config.enginePaths = config.enginePaths.filter(p => p !== pathToRemove);
        } else {
            config.projectPaths = config.projectPaths.filter(p => p !== pathToRemove);
        }
        await saveConfig(config);
        return true;
    });

    // ── Tags ──
    ipcMain.handle('get-project-tags', async () => {
        return readJsonFile<Record<string, string[]>>(TAGS_PATH, {});
    });

    ipcMain.handle('save-project-tags', async (_, tags: Record<string, string[]>) => {
        await writeJsonFile(TAGS_PATH, tags);
    });

    // ── Favorites ──
    ipcMain.handle('get-favorites', async () => {
        return readJsonFile<string[]>(FAVORITES_PATH, []);
    });

    ipcMain.handle('toggle-favorite', async (_, projectPath: string) => {
        const favorites = await readJsonFile<string[]>(FAVORITES_PATH, []);
        const updated = favorites.includes(projectPath)
            ? favorites.filter(f => f !== projectPath)
            : [...favorites, projectPath];
        await writeJsonFile(FAVORITES_PATH, updated);
        return updated;
    });

    // ── Notes ──
    ipcMain.handle('get-project-notes', async () => {
        return readJsonFile<Record<string, string>>(NOTES_PATH, {});
    });

    ipcMain.handle('save-project-notes', async (_, notes: Record<string, string>) => {
        await writeJsonFile(NOTES_PATH, notes);
    });

    // ── VCS integration prefs (per project) ──
    ipcMain.handle('get-project-vcs-prefs', async () => {
        return readJsonFile<Record<string, ProjectVcsPref>>(VCS_PREFS_PATH, {});
    });

    ipcMain.handle('save-project-vcs-pref', async (_, projectPath: string, pref: ProjectVcsPref | null) => {
        const all = await readJsonFile<Record<string, ProjectVcsPref>>(VCS_PREFS_PATH, {});
        if (!pref || (pref.git === undefined && pref.diversion === undefined)) {
            delete all[projectPath];
        } else {
            const next: ProjectVcsPref = {};
            if (pref.git === 'on' || pref.git === 'off') next.git = pref.git;
            if (pref.diversion === 'on' || pref.diversion === 'off') next.diversion = pref.diversion;
            if (Object.keys(next).length === 0) {
                delete all[projectPath];
            } else {
                all[projectPath] = next;
            }
        }
        await writeJsonFile(VCS_PREFS_PATH, all);
    });
}
