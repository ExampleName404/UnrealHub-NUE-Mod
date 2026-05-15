import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface UpluginData {
    FileVersion?: number;
    Version?: number;
    VersionName?: string;
    FriendlyName?: string;
    Description?: string;
    Category?: string;
    CreatedBy?: string;
    CreatedByURL?: string;
    DocsURL?: string;
    MarketplaceURL?: string;
    CanContainContent?: boolean;
    IsBetaVersion?: boolean;
    IsExperimentalVersion?: boolean;
    EnabledByDefault?: boolean;
    Installed?: boolean;
    Modules?: Array<{ Name: string; Type: string; LoadingPhase?: string }>;
}

export interface PluginInfo {
    name: string;
    friendlyName: string;
    description: string;
    category: string;
    version: string;
    createdBy: string;
    enabledByDefault: boolean;
    isExperimental: boolean;
    isBeta: boolean;
    canContainContent: boolean;
    installed: boolean;
    pluginPath: string;
    iconPath: string | null;
    modules: string[];
}

export interface VaultAssetInfo {
    id: string;
    appName: string;
    catalogItemId: string;
    title: string;
    buildVersion: string;
    installPath: string;
    sizeBytes: number;
    // Whether this vault entry was recognized as an installed asset
    installed?: boolean;
    // Types of recognizable content found (e.g. Content, Plugin, uasset)
    recognizedTypes?: string[];
    // Optional thumbnail image as base64 data URL
    thumbnail?: string;
}

interface InstalledManifest {
    installLocation: string;
    appName: string;
    catalogItemId: string;
    displayName: string;
    appVersion: string;
    namespace: string;
}

async function scanPluginsRecursive(dirPath: string, maxDepth: number = 5): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = [];
    if (maxDepth <= 0) return plugins;

    try {
        if (!existsSync(dirPath)) return plugins;
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isFile() && entry.name.endsWith('.uplugin')) {
                try {
                    const raw = readFileSync(fullPath, 'utf-8');
                    // Handle BOM
                    let clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
                    // UE .uplugin files often have trailing commas (invalid JSON)
                    // Strip: comma followed by whitespace then ] or }
                    clean = clean.replace(/,\s*([\]}])/g, '$1');
                    const data: UpluginData = JSON.parse(clean);
                    const pluginDir = path.dirname(fullPath);
                    const pluginName = path.basename(fullPath, '.uplugin');

                    // Look for icon
                    let iconPath: string | null = null;
                    const icon128 = path.join(pluginDir, 'Resources', 'Icon128.png');
                    const pluginIcon = path.join(pluginDir, `${pluginName}.png`);
                    if (existsSync(icon128)) iconPath = icon128;
                    else if (existsSync(pluginIcon)) iconPath = pluginIcon;

                    plugins.push({
                        name: pluginName,
                        friendlyName: data.FriendlyName || pluginName,
                        description: data.Description || '',
                        category: data.Category || 'Other',
                        version: data.VersionName || '1.0',
                        createdBy: data.CreatedBy || '',
                        enabledByDefault: data.EnabledByDefault ?? false,
                        isExperimental: data.IsExperimentalVersion ?? false,
                        isBeta: data.IsBetaVersion ?? false,
                        canContainContent: data.CanContainContent ?? false,
                        installed: true,
                        pluginPath: pluginDir,
                        iconPath,
                        modules: (data.Modules || []).map(m => m.Name),
                    });
                } catch (e) {
                    console.error(`Error parsing plugin ${fullPath}:`, e);
                }
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                const subPlugins = await scanPluginsRecursive(fullPath, maxDepth - 1);
                plugins.push(...subPlugins);
            }
        }
    } catch (e) {
        console.error('Error scanning plugins directory:', e);
    }

    return plugins;
}

async function scanVaultCache(): Promise<VaultAssetInfo[]> {
    const assets: VaultAssetInfo[] = [];

    // Helper: try to extract a thumbnail from asset directory
    const extractThumbnail = async (assetDir: string): Promise<string | undefined> => {
        try {
            // Look for common image files
            const entries = await fs.readdir(assetDir, { withFileTypes: true });
            const imageFiles = entries.filter(e => 
                e.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(e.name)
            );
            
            if (imageFiles.length > 0) {
                // Prefer .png, then .jpg/.jpeg
                let imageFile = imageFiles.find(e => e.name.endsWith('.png'));
                if (!imageFile) imageFile = imageFiles.find(e => /\.(jpg|jpeg)$/i.test(e.name));
                if (!imageFile) imageFile = imageFiles[0];
                
                if (imageFile) {
                    const imagePath = path.join(assetDir, imageFile.name);
                    const imageBuffer = await fs.readFile(imagePath);
                    const base64 = imageBuffer.toString('base64');
                    const ext = path.extname(imageFile.name).toLowerCase().slice(1);
                    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                    return `data:${mimeType};base64,${base64}`;
                }
            }
        } catch { /* ignore thumbnail extraction errors */ }
        return undefined;
    };

    // Common vault cache locations on Windows & macOS
    const possiblePaths = [
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'VaultCache'),
        path.join(process.env.LOCALAPPDATA || '', 'EpicGamesLauncher', 'VaultCache'),
        path.join('/Users/Shared/Epic Games/EpicGamesLauncher/VaultCache'),
        path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'VaultCache')
    ];

    for (const vaultPath of possiblePaths) {
        if (!existsSync(vaultPath)) continue;

        const getRecursiveSize = async (dirPath: string): Promise<number> => {
            let total = 0;
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        total += await getRecursiveSize(fullPath);
                    } else if (entry.isFile()) {
                        const stat = await fs.stat(fullPath);
                        total += stat.size;
                    }
                }
            } catch { /* ignore */ }
            return total;
        };

        try {
            const entries = await fs.readdir(vaultPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const assetDir = path.join(vaultPath, entry.name);

                // Legendary-style downloads or manual copies may store a top-level Content folder
                // or various recognizable files (uasset, umap, .uplugin). Walk deeper to find them.
                const recognizedTypes: string[] = [];
                const findContentAndCount = async (p: string, depth = 4): Promise<{foundPath: string | null, size: number}> => {
                    if (depth < 0) return { foundPath: null, size: 0 };
                    try {
                        if (!existsSync(p)) return { foundPath: null, size: 0 };
                        const entries2 = await fs.readdir(p, { withFileTypes: true });
                        // If a Content folder exists, prefer it
                        const contentEntry = entries2.find(e => e.isDirectory() && e.name.toLowerCase() === 'content');
                        if (contentEntry) {
                            const contentPath = path.join(p, contentEntry.name);
                            recognizedTypes.push('Content');
                            const sz = await getRecursiveSize(contentPath);
                            return { foundPath: contentPath, size: sz };
                        }

                        // Look for plugin descriptors or a folder containing .uasset/.umap
                        let accumulatedSize = 0;
                        for (const e2 of entries2) {
                            const full = path.join(p, e2.name);
                            if (e2.isFile()) {
                                if (e2.name.endsWith('.uplugin')) {
                                    recognizedTypes.push('Plugin');
                                    const st = await fs.stat(full);
                                    accumulatedSize += st.size;
                                }
                                if (e2.name.endsWith('.uasset') || e2.name.endsWith('.umap')) {
                                    if (!recognizedTypes.includes('uasset')) recognizedTypes.push('uasset');
                                    const st = await fs.stat(full);
                                    accumulatedSize += st.size;
                                }
                            } else if (e2.isDirectory() && !e2.name.startsWith('.') && e2.name !== 'node_modules') {
                                const res = await findContentAndCount(full, depth - 1);
                                if (res.foundPath) return res;
                                accumulatedSize += res.size;
                            }
                        }
                        return { foundPath: null, size: accumulatedSize };
                    } catch (e) {
                        return { foundPath: null, size: 0 };
                    }
                };

                const topResult = await findContentAndCount(assetDir, 5);
                // Only add if we found meaningful content with real size
                if ((topResult.foundPath || topResult.size > 0) && recognizedTypes.length > 0) {
                    // Try to find a nice display name
                    let displayName = entry.name;
                    
                    // 1. Try to read .manifest file for DisplayName
                    try {
                        const subEntries = await fs.readdir(assetDir, { withFileTypes: true });
                        const manifestFile = subEntries
                            .filter(e => e.isFile() && e.name.endsWith('.manifest'))
                            .map(e => path.join(assetDir, e.name))[0];
                        
                        if (manifestFile && existsSync(manifestFile)) {
                            const manifestContent = readFileSync(manifestFile, 'utf-8');
                            const manifestData = JSON.parse(manifestContent);
                            if (manifestData.DisplayName) {
                                displayName = manifestData.DisplayName;
                            }
                        }
                    } catch { /* ignore */ }
                    
                    // 2. If Content folder exists, try first subfolder name
                    if (displayName === entry.name && topResult.foundPath) {
                        try {
                            const contentEntries = await fs.readdir(topResult.foundPath, { withFileTypes: true });
                            const firstDir = contentEntries.find(e => e.isDirectory() && !e.name.startsWith('.'));
                            if (firstDir) {
                                displayName = firstDir.name;
                            }
                        } catch { /* ignore */ }
                    }
                    
                    // 3. Try to extract thumbnail image
                    const thumbnail = await extractThumbnail(assetDir);
                    
                    console.log(`[Vault] Adding: ${entry.name} (display="${displayName}") - size=${topResult.size}, types=${recognizedTypes.join(',')}`);
                    assets.push({
                        id: entry.name,
                        appName: entry.name,
                        catalogItemId: '',
                        title: displayName,
                        buildVersion: '',
                        installPath: assetDir,
                        sizeBytes: topResult.size,
                        installed: true,
                        recognizedTypes: recognizedTypes,
                        thumbnail,
                    });
                    // If we detected meaningful content, continue to next asset
                    if (topResult.foundPath) continue;
                }

                // Each vault asset has subdirectories with .manifest files
                try {
                    const subEntries = await fs.readdir(assetDir, { withFileTypes: true });
                    for (const sub of subEntries) {
                        if (!sub.isDirectory()) continue;

                        const manifestDir = path.join(assetDir, sub.name);
                        const manifestFiles = await fs.readdir(manifestDir);
                        const manifest = manifestFiles.find(f => f.endsWith('.manifest'));

                        if (manifest) {
                            try {
                                const manifestContent = readFileSync(path.join(manifestDir, manifest), 'utf-8');
                                const manifestData = JSON.parse(manifestContent);

                                // Calculate directory size
                                let totalSize = 0;
                                try {
                                    const dataPath = path.join(manifestDir, 'data');
                                    if (existsSync(dataPath)) {
                                        const dataFiles = await fs.readdir(dataPath);
                                        for (const df of dataFiles) {
                                            const stat = await fs.stat(path.join(dataPath, df));
                                            totalSize += stat.size;
                                        }
                                    }
                                } catch { /* ignore */ }

                                assets.push({
                                    id: entry.name,
                                    appName: manifestData.AppNameString || entry.name,
                                    catalogItemId: manifestData.CatalogItemId || '',
                                    title: manifestData.DisplayName || manifestData.AppNameString || entry.name,
                                    buildVersion: manifestData.BuildVersionString || '',
                                    installPath: manifestDir,
                                    sizeBytes: totalSize,
                                });
                            } catch {
                                // manifest parse error, skip
                            }
                        }
                    }
                } catch { /* ignore sub dir errors */ }
            }
        } catch (e) {
            console.error('Error scanning vault cache:', e);
        }
    }

    console.log(`[Vault] Scan complete: ${assets.length} assets found with content`);
    return assets;
}

// Scan for .item files from Epic's manifests directory
async function scanInstalledManifests(): Promise<InstalledManifest[]> {
    const items: InstalledManifest[] = [];
    const manifestsPaths = [
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests'),
        path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
    ];

    for (const manifestsPath of manifestsPaths) {
        if (!existsSync(manifestsPath)) continue;

        try {
            const files = await fs.readdir(manifestsPath);
            for (const file of files) {
                if (!file.endsWith('.item')) continue;
                try {
                    const content = readFileSync(path.join(manifestsPath, file), 'utf-8');
                    const data = JSON.parse(content);
                    items.push({
                        installLocation: data.InstallLocation || '',
                        appName: data.AppName || '',
                        catalogItemId: data.CatalogItemId || '',
                        displayName: data.DisplayName || data.AppName || '',
                        appVersion: data.AppVersionString || '',
                        namespace: data.MainGameCatalogNamespace || data.CatalogNamespace || '',
                    });
                } catch { /* skip malformed items */ }
            }
        } catch { /* ignore */ }
    }

    return items;
}

async function deleteRecursive(dirPath: string): Promise<void> {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                await deleteRecursive(fullPath);
            } else {
                await fs.unlink(fullPath);
            }
        }
        await fs.rmdir(dirPath);
    } catch (e) {
        console.error(`Error deleting ${dirPath}:`, e);
        throw e;
    }
}

async function deleteVaultAsset(assetId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const possiblePaths = [
            path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'VaultCache'),
            path.join(process.env.LOCALAPPDATA || '', 'EpicGamesLauncher', 'VaultCache'),
            path.join('/Users/Shared/Epic Games/EpicGamesLauncher/VaultCache'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'VaultCache')
        ];

        for (const vaultPath of possiblePaths) {
            if (!existsSync(vaultPath)) continue;

            const assetDir = path.join(vaultPath, assetId);
            if (existsSync(assetDir)) {
                await deleteRecursive(assetDir);
                console.log(`[Vault] Deleted asset: ${assetId}`);
                return { success: true };
            }
        }

        return { success: false, error: 'Asset not found' };
    } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Error deleting vault asset ${assetId}:`, error);
        return { success: false, error };
    }
}

async function clearVaultCache(): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
        let totalDeleted = 0;
        const possiblePaths = [
            path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'VaultCache'),
            path.join(process.env.LOCALAPPDATA || '', 'EpicGamesLauncher', 'VaultCache'),
            path.join('/Users/Shared/Epic Games/EpicGamesLauncher/VaultCache'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'VaultCache')
        ];

        for (const vaultPath of possiblePaths) {
            if (!existsSync(vaultPath)) continue;

            try {
                const entries = await fs.readdir(vaultPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const assetDir = path.join(vaultPath, entry.name);
                        await deleteRecursive(assetDir);
                        totalDeleted++;
                    }
                }
            } catch (e) {
                console.error(`Error clearing vault at ${vaultPath}:`, e);
            }
        }

        console.log(`[Vault] Cleared cache: ${totalDeleted} assets deleted`);
        return { success: true, deleted: totalDeleted };
    } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown error';
        console.error('Error clearing vault cache:', error);
        return { success: false, deleted: 0, error };
    }
}

export function registerMarketplaceHandlers() {
    // Scan all plugins in an engine's Plugin directory
    ipcMain.handle('scan-engine-plugins', async (_, enginePath: string) => {
        const pluginsDir = path.join(enginePath, 'Engine', 'Plugins');
        if (!existsSync(pluginsDir)) return [];
        return scanPluginsRecursive(pluginsDir);
    });

    // Scan plugins in a project's Plugins directory
    ipcMain.handle('scan-project-plugins', async (_, projectPath: string) => {
        const pluginsDir = path.join(path.dirname(projectPath), 'Plugins');
        if (!existsSync(pluginsDir)) return [];
        return scanPluginsRecursive(pluginsDir, 3);
    });

    // Get all vault cache assets
    ipcMain.handle('get-vault-assets', async () => {
        return scanVaultCache();
    });

    // Get installed manifests (.item files)
    ipcMain.handle('get-installed-manifests', async () => {
        return scanInstalledManifests();
    });

    // Open plugin folder in explorer
    ipcMain.handle('show-plugin-in-explorer', async (_, pluginPath: string) => {
        const { shell } = await import('electron');
        shell.showItemInFolder(pluginPath);
    });

    // Delete a single vault asset
    ipcMain.handle('delete-vault-asset', async (_, assetId: string) => {
        return deleteVaultAsset(assetId);
    });

    // Clear entire vault cache
    ipcMain.handle('clear-vault-cache', async () => {
        return clearVaultCache();
    });
}
