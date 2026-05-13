import { ipcMain, dialog } from 'electron';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig } from '../services/configStore';

// Locations where Epic Games Launcher typically installs Unreal Engine.
function getStandardEngineSearchRoots(): string[] {
    const roots: string[] = [];
    if (process.platform === 'win32') {
        const drives = ['C:', 'D:', 'E:', 'F:'];
        for (const d of drives) {
            roots.push(`${d}\\Program Files\\Epic Games`);
            roots.push(`${d}\\Epic Games`);
        }
    } else if (process.platform === 'darwin') {
        roots.push('/Users/Shared/Epic Games');
        roots.push(path.join(os.homedir(), 'Library', 'Application Support', 'Epic'));
    } else {
        roots.push(path.join(os.homedir(), 'Epic Games'));
    }
    return roots;
}

// A directory counts as an engine root if it contains Engine/Binaries directly,
// or contains UE_X.Y subfolders that do.
async function findEngineInstallsUnder(root: string): Promise<string[]> {
    const found: string[] = [];
    if (!existsSync(root)) return found;

    try {
        if (existsSync(path.join(root, 'Engine', 'Binaries'))) {
            found.push(root);
            return found;
        }
        const entries = await fs.readdir(root, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (!entry.name.startsWith('UE_')) continue;
            const sub = path.join(root, entry.name);
            if (existsSync(path.join(sub, 'Engine', 'Binaries'))) {
                // Parent dir is the search root we want to add (it groups versions)
                if (!found.includes(root)) found.push(root);
            }
        }
    } catch { /* ignore unreadable dirs */ }

    return found;
}

export function registerEngineHandlers() {
    ipcMain.handle('get-engines', async () => {
        const config = await loadConfig();
        const engines: { version: string; path: string }[] = [];
        const processedPaths = new Set<string>();

        for (const checkPath of config.enginePaths) {
            if (processedPaths.has(checkPath)) continue;
            processedPaths.add(checkPath);

            try {
                if (!existsSync(checkPath)) continue;

                const binaryPath = path.join(checkPath, 'Engine', 'Binaries');
                if (existsSync(binaryPath)) {
                    engines.push({ version: path.basename(checkPath).replace('UE_', ''), path: checkPath });
                    continue;
                }

                const dirs = await fs.readdir(checkPath);
                for (const dir of dirs) {
                    if (dir.startsWith('UE_')) {
                        engines.push({ version: dir.replace('UE_', ''), path: path.join(checkPath, dir) });
                    }
                }
            } catch (e) {
                console.error('Error scanning path ' + checkPath, e);
            }
        }

        return engines;
    });

    ipcMain.handle('add-engine-path', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
        if (result.canceled) return false;
        const addedPath = result.filePaths[0];
        const config = await loadConfig();
        if (!config.enginePaths.includes(addedPath)) {
            config.enginePaths.push(addedPath);
            await saveConfig(config);
            return true;
        }
        return false;
    });

    ipcMain.handle('auto-detect-engine-paths', async () => {
        const roots = getStandardEngineSearchRoots();
        const config = await loadConfig();
        const existing = new Set(config.enginePaths);

        const foundPaths: string[] = [];
        for (const root of roots) {
            const hits = await findEngineInstallsUnder(root);
            for (const hit of hits) {
                if (!foundPaths.includes(hit)) foundPaths.push(hit);
            }
        }

        const added = foundPaths.filter(p => !existing.has(p));
        if (added.length > 0) {
            config.enginePaths.push(...added);
            await saveConfig(config);
        }
        return { found: foundPaths, added };
    });

    ipcMain.handle('launch-engine', async (_, enginePath: string) => {
        const possiblePaths = [
            path.join(enginePath, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe'), // Windows UE5
            path.join(enginePath, 'Engine', 'Binaries', 'Win64', 'UE4Editor.exe'),    // Windows UE4
            path.join(enginePath, 'Engine', 'Binaries', 'Mac', 'UnrealEditor.app', 'Contents', 'MacOS', 'UnrealEditor'), // Mac UE5
            path.join(enginePath, 'Engine', 'Binaries', 'Mac', 'UE4Editor.app', 'Contents', 'MacOS', 'UE4Editor'),       // Mac UE4
            path.join(enginePath, 'Engine', 'Binaries', 'Linux', 'UnrealEditor'),     // Linux UE5
            path.join(enginePath, 'Engine', 'Binaries', 'Linux', 'UE4Editor')         // Linux UE4
        ];
        for (const exePath of possiblePaths) {
            if (existsSync(exePath)) {
                const { spawn } = await import('node:child_process');
                const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
                child.unref();
                return true;
            }
        }
        return false;
    });
}
