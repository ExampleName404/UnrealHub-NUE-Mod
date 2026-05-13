import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppearance } from '../context/AppearanceContext';
import { Folder, Trash2, Plus, Play, FolderOpen, FileText, Eraser, Copy, Settings as SettingsIcon, Tag, StickyNote, Palette, Sparkles, ChevronRight, FolderX, RefreshCw, Archive, Wand2, Plug2 } from 'lucide-react';

interface ConfigPaths {
    enginePaths: string[];
    projectPaths: string[];
}

interface ContextMenuConfig {
    launch: boolean;
    showInExplorer: boolean;
    showLogs: boolean;
    cleanCache: boolean;
    clone: boolean;
    editConfig: boolean;
    manageTags: boolean;
    stats: boolean;
    notes: boolean;
    kanban: boolean;
    smartBackup: boolean;
    gitAutoBackup: boolean;
    removeProject: boolean;
    deleteProject: boolean;
}

const defaultMenuConfig: ContextMenuConfig = {
    launch: true,
    showInExplorer: true,
    showLogs: true,
    cleanCache: true,
    clone: true,
    editConfig: true,
    manageTags: true,
    stats: true,
    notes: true,
    kanban: true,
    smartBackup: true,
    gitAutoBackup: true,
    removeProject: true,
    deleteProject: true
};

const menuItems: { key: keyof ContextMenuConfig; icon: React.ElementType; color: string }[] = [
    { key: 'launch', icon: Play, color: 'text-green-400' },
    { key: 'showInExplorer', icon: FolderOpen, color: 'text-primary' },
    { key: 'showLogs', icon: FileText, color: 'text-slate-400' },
    { key: 'editConfig', icon: SettingsIcon, color: 'text-slate-400' },
    { key: 'manageTags', icon: Tag, color: 'text-orange-400' },
    { key: 'stats', icon: FileText, color: 'text-teal-400' },
    { key: 'notes', icon: StickyNote, color: 'text-amber-400' },
    { key: 'kanban', icon: FileText, color: 'text-purple-400' },
    { key: 'clone', icon: Copy, color: 'text-cyan-400' },
    { key: 'cleanCache', icon: Eraser, color: 'text-yellow-400' },
    { key: 'smartBackup', icon: FolderOpen, color: 'text-blue-400' },
    { key: 'gitAutoBackup', icon: Archive, color: 'text-violet-400' },
    { key: 'removeProject', icon: Trash2, color: 'text-red-400' },
    { key: 'deleteProject', icon: FolderX, color: 'text-red-500' },
];

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-all duration-300 ${checked ? 'bg-[var(--accent-color)] shadow-[0_0_12px_var(--accent-color)]/30' : 'bg-slate-700'}`}
    >
        <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${checked ? 'translate-x-5' : ''}`} />
    </button>
);

const SectionCard = ({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description?: string; children: React.ReactNode }) => (
    <div className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.04] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.04] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-white" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
                {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
            </div>
        </div>
        <div className="divide-y divide-white/[0.03]">
            {children}
        </div>
    </div>
);

const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
        <div className="min-w-0 mr-4">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
        </div>
        <div className="shrink-0">{children}</div>
    </div>
);

const SegmentPicker = ({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (val: string) => void }) => (
    <div className="flex bg-slate-800/60 p-1 rounded-xl border border-white/[0.04]">
        {options.map(opt => (
            <button
                key={opt.key}
                onClick={() => onChange(opt.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${value === opt.key
                    ? 'bg-[var(--accent-color)] text-white shadow-lg shadow-[var(--accent-color)]/20'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

export const SettingsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { accentColor, setAccentColor, compactMode, setCompactMode, bgEffect, setBgEffect, reduceAnimations, setReduceAnimations, fontSize, setFontSize } = useAppearance();
    const [paths, setPaths] = useState<ConfigPaths>({ enginePaths: [], projectPaths: [] });
    const [loading, setLoading] = useState(true);
    const [menuConfig, setMenuConfig] = useState<ContextMenuConfig>(defaultMenuConfig);

    const [appVersion, setAppVersion] = useState<string>('');
    const [epicAuth, setEpicAuth] = useState<{ loggedIn: boolean; displayName?: string; accountId?: string }>({ loggedIn: false });
    const [epicAuthLoading, setEpicAuthLoading] = useState(false);
    const [diversionCli, setDiversionCli] = useState<{
        available: boolean;
        version?: string;
        error?: string;
        path?: string;
        searchedCandidates?: string[];
    } | null>(null);
    const [diversionDetailsOpen, setDiversionDetailsOpen] = useState(false);

    const loadPaths = async () => {
        try {
            const data = await window.unreal.getConfigPaths();
            setPaths(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadEpicAuthStatus = async () => {
        try {
            if (window.unreal && window.unreal.epicAuthStatus) {
                const status = await window.unreal.epicAuthStatus();
                setEpicAuth(status);
            }
        } catch (e) {
            console.error('Failed to check Epic auth status', e);
            setEpicAuth({ loggedIn: false });
        }
    };

    const refreshDiversionCli = async () => {
        try {
            if (!window.unreal?.diversionCheckCli) return;
            const res = await window.unreal.diversionCheckCli();
            setDiversionCli(res);
        } catch (e) {
            console.error('Failed to check dv CLI', e);
            setDiversionCli({ available: false, error: 'check_failed' });
        }
    };

    useEffect(() => {
        loadPaths();
        const storedConfig = localStorage.getItem('contextMenuConfig');
        if (storedConfig) {
            setMenuConfig({ ...defaultMenuConfig, ...JSON.parse(storedConfig) });
        }

        if (window.unreal && window.unreal.getAppVersion) {
            window.unreal.getAppVersion().then((v: string) => setAppVersion(v));
        }

        loadEpicAuthStatus();
        refreshDiversionCli();
    }, []);

    const handleAddEnginePath = async () => {
        const added = await window.unreal.addEnginePath();
        if (added) await loadPaths();
    };

    const handleAddProjectPath = async () => {
        const added = await window.unreal.addProjectPath();
        if (added) await loadPaths();
    };

    const handleAutoDetect = async (type: 'engine' | 'project') => {
        const fn = type === 'engine'
            ? window.unreal.autoDetectEnginePaths
            : window.unreal.autoDetectProjectPaths;
        const result = await fn();
        if (result.added.length > 0) await loadPaths();

        if (result.added.length > 0) {
            alert(t('settings.autoDetectAdded', { count: result.added.length, defaultValue: `Added ${result.added.length} path(s).` }));
        } else if (result.found.length > 0) {
            alert(t('settings.autoDetectAllKnown', 'All detected paths are already added.'));
        } else {
            alert(t('settings.autoDetectNothing', 'No standard paths found on this machine.'));
        }
    };

    const handleRemovePath = async (type: 'engine' | 'project', path: string) => {
        await window.unreal.removePath(type, path);
        await loadPaths();
    };

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('i18nextLng', lng);
    };

    const currentLanguage = (i18n.resolvedLanguage || i18n.language || 'tr').split('-')[0];

    const toggleContextMenu = (key: keyof ContextMenuConfig) => {
        const newConfig = { ...menuConfig, [key]: !menuConfig[key] };
        setMenuConfig(newConfig);
        localStorage.setItem('contextMenuConfig', JSON.stringify(newConfig));
        window.dispatchEvent(new Event('storage'));
    };

    const handleUpdaterRemoved = () => {
        alert(t('settings.updaterRemoved'));
    };

    const handleEpicLogin = async () => {
        setEpicAuthLoading(true);
        try {
            const result = await window.unreal.epicLogin();
            if (!result.success && result.error) {
                alert(result.error);
            }
            await loadEpicAuthStatus();
        } catch (e) {
            console.error('Epic login failed:', e);
        } finally {
            setEpicAuthLoading(false);
        }
    };

    const handleEpicLogout = async () => {
        setEpicAuthLoading(true);
        try {
            await window.unreal.epicLogout();
            setEpicAuth({ loggedIn: false });
        } catch (e) {
            console.error('Epic logout failed:', e);
        } finally {
            setEpicAuthLoading(false);
        }
    };

    if (loading) return <div className="text-slate-400">{t('git.loading')}</div>;

    const accentColors = [
        { key: 'blue', bg: '#3b82f6' },
        { key: 'green', bg: '#22c55e' },
        { key: 'purple', bg: '#a855f7' },
        { key: 'orange', bg: '#f97316' },
        { key: 'cyan', bg: '#06b6d4' },
        { key: 'red', bg: '#ef4444' },
    ] as const;

    const PathList = ({ type, items, onAdd, onRemove }: { type: 'engine' | 'project'; items: string[]; onAdd: () => void; onRemove: (t: 'engine' | 'project', p: string) => void }) => (
        <div>
            {items.length === 0 ? (
                <div className="px-6 py-8 text-center">
                    <Folder size={24} className="text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">{t('settings.noFolders')}</p>
                </div>
            ) : (
                items.map((path) => (
                    <div key={path} className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                            <Folder size={15} className="text-slate-600 shrink-0" />
                            <span className="font-mono text-xs text-slate-400 truncate" title={path}>{path}</span>
                        </div>
                        <button
                            onClick={() => onRemove(type, path)}
                            className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))
            )}
            <div className="px-6 py-3 border-t border-white/[0.03] flex flex-wrap items-center gap-x-5 gap-y-2">
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-color)] hover:text-white transition-colors group"
                >
                    <Plus size={14} className="group-hover:scale-110 transition-transform" />
                    {t('settings.addFolder')}
                </button>
                <button
                    onClick={() => handleAutoDetect(type)}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors group"
                >
                    <Wand2 size={14} className="group-hover:scale-110 transition-transform" />
                    {type === 'engine'
                        ? t('settings.autoDetectEngine', 'Find Epic Games / UE')
                        : t('settings.autoDetectProject', 'Find Unreal Projects')}
                </button>
                <p className="basis-full text-[10px] text-slate-600 mt-0.5">
                    {type === 'engine' ? t('settings.engineDesc') : t('settings.projectDesc')}
                </p>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="mb-10">
                <h2 className="text-3xl font-black text-white tracking-tight">
                    {t('settings.title').toUpperCase()}
                </h2>
            </div>

            <div className="space-y-6">
                <SectionCard icon={Palette} title={t('settings.appearance')}>
                    <SettingRow label={t('settings.language')} description={t('settings.selectLanguage')}>
                        <div className="relative">
                            <select
                                value={currentLanguage}
                                onChange={(e) => changeLanguage(e.target.value)}
                                className="appearance-none bg-slate-800/60 border border-white/[0.06] hover:border-white/[0.12] focus:border-[var(--accent-color)] focus:outline-none rounded-xl pl-4 pr-9 py-2 text-sm font-medium text-slate-200 cursor-pointer transition-colors min-w-[160px]"
                            >
                                <option value="en">🇬🇧  English</option>
                                <option value="ru">🇷🇺  Русский</option>
                                <option value="tr">🇹🇷  Türkçe</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                        </div>
                    </SettingRow>

                    <SettingRow label={t('settings.accentColor')}>
                        <div className="flex gap-2">
                            {accentColors.map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => setAccentColor(c.key)}
                                    className={`w-7 h-7 rounded-full transition-all duration-300 border-2 ${accentColor === c.key
                                        ? 'scale-125 border-white shadow-lg'
                                        : 'border-transparent hover:scale-110 opacity-60 hover:opacity-100'
                                        }`}
                                    style={{ backgroundColor: c.bg, boxShadow: accentColor === c.key ? `0 0 14px ${c.bg}` : undefined }}
                                />
                            ))}
                        </div>
                    </SettingRow>

                    <SettingRow label={t('settings.bgEffect')}>
                        <SegmentPicker
                            options={[
                                { key: 'gradient', label: t('settings.effects.gradient') },
                                { key: 'flat', label: t('settings.effects.flat') },
                                { key: 'glass', label: t('settings.effects.glass') },
                            ]}
                            value={bgEffect}
                            onChange={(v) => setBgEffect(v as 'gradient' | 'flat' | 'glass')}
                        />
                    </SettingRow>

                    <SettingRow label={t('settings.fontSize')}>
                        <SegmentPicker
                            options={[
                                { key: 'normal', label: t('settings.sizes.normal') },
                                { key: 'large', label: t('settings.sizes.large') },
                                { key: 'xlarge', label: t('settings.sizes.xlarge') },
                            ]}
                            value={fontSize}
                            onChange={(v) => setFontSize(v as 'normal' | 'large' | 'xlarge')}
                        />
                    </SettingRow>

                    <SettingRow label={t('settings.compactMode')}>
                        <Toggle checked={compactMode} onChange={setCompactMode} />
                    </SettingRow>

                    <SettingRow label={t('settings.reduceAnimations')}>
                        <Toggle checked={reduceAnimations} onChange={setReduceAnimations} />
                    </SettingRow>
                </SectionCard>

                <SectionCard icon={Sparkles} title={t('settings.epicAuth.sectionTitle')} description={t('settings.epicAuth.sectionDesc')}>
                    <SettingRow
                        label={t('settings.epicAuth.authStatusLabel', 'Authorization')}
                        description={epicAuth.loggedIn
                            ? t('settings.epicAuth.authorized', 'Authorized')
                            : t('settings.epicAuth.notAuthorized', 'Not authorized')}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${epicAuth.loggedIn ? 'bg-green-500/15 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                {epicAuth.loggedIn
                                    ? (epicAuth.displayName || t('settings.epicAuth.authorized', 'Authorized'))
                                    : t('settings.epicAuth.notAuthorized', 'Not authorized')}
                            </div>
                            {epicAuth.loggedIn ? (
                                <button
                                    onClick={handleEpicLogout}
                                    disabled={epicAuthLoading}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg text-sm transition-colors"
                                >
                                    {epicAuthLoading ? t('marketplace.loggingIn', 'Loading...') : t('marketplace.logout', 'Logout')}
                                </button>
                            ) : (
                                <button
                                    onClick={handleEpicLogin}
                                    disabled={epicAuthLoading}
                                    className="px-3 py-1.5 bg-[var(--accent-color)] hover:opacity-90 disabled:opacity-60 text-white rounded-lg text-sm transition-colors"
                                >
                                    {epicAuthLoading ? t('marketplace.loggingIn', 'Logging in...') : t('marketplace.loginButton', 'Sign in with Epic Games')}
                                </button>
                            )}
                        </div>
                    </SettingRow>
                </SectionCard>

                <SectionCard icon={Plug2} title={t('settings.diversion.sectionTitle')} description={t('settings.diversion.sectionDesc')}>
                    <SettingRow
                        label={t('settings.diversion.cliLabel')}
                        description={
                            diversionCli === null
                                ? t('settings.diversion.cliChecking')
                                : diversionCli.available
                                    ? (diversionCli.version || t('settings.diversion.cliInstalled'))
                                    : t('settings.diversion.cliMissing')
                        }
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                diversionCli?.available
                                    ? 'bg-green-500/15 text-green-400'
                                    : 'bg-slate-800 text-slate-400'
                            }`}>
                                {diversionCli === null
                                    ? '...'
                                    : diversionCli.available
                                        ? t('settings.diversion.cliInstalled')
                                        : t('settings.diversion.cliMissing')}
                            </div>
                            <button
                                onClick={refreshDiversionCli}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                            >
                                {t('settings.diversion.recheck')}
                            </button>
                            {!diversionCli?.available && (
                                <>
                                    <button
                                        onClick={() => setDiversionDetailsOpen(s => !s)}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                                    >
                                        {diversionDetailsOpen ? t('settings.diversion.hideDetails') : t('settings.diversion.showDetails')}
                                    </button>
                                    <a
                                        href="https://diversion.dev/downloads"
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className="px-3 py-1.5 bg-[var(--accent-color)] hover:opacity-90 text-white rounded-lg text-sm transition-colors"
                                    >
                                        {t('settings.diversion.install')}
                                    </a>
                                </>
                            )}
                        </div>
                    </SettingRow>
                    {diversionCli && !diversionCli.available && diversionDetailsOpen && (
                        <div className="px-6 py-4 bg-slate-950/30 border-t border-white/[0.04]">
                            {diversionCli.error && (
                                <div className="mb-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                        {t('settings.diversion.errorLabel')}
                                    </div>
                                    <pre className="text-[11px] text-red-300 font-mono whitespace-pre-wrap bg-slate-900/60 border border-red-500/10 rounded-lg p-3 max-h-[120px] overflow-auto">
                                        {diversionCli.error}
                                    </pre>
                                </div>
                            )}
                            {diversionCli.searchedCandidates && diversionCli.searchedCandidates.length > 0 && (
                                <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                        {t('settings.diversion.searchedLabel')}
                                    </div>
                                    <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap bg-slate-900/60 border border-white/[0.04] rounded-lg p-3 max-h-[160px] overflow-auto">
                                        {diversionCli.searchedCandidates.join('\n')}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </SectionCard>

                <SectionCard icon={RefreshCw} title={t('settings.updates')}>
                    <div className="p-6 flex flex-col items-center">
                        <div className="mb-4 text-center">
                            <h4 className="text-xl font-bold text-white">UnrealHub by Dmitry</h4>
                            <p className="text-sm text-slate-400">v{appVersion}</p>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={handleUpdaterRemoved}
                                className="px-5 py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/80 text-white rounded-xl font-bold transition-colors text-sm"
                            >
                                {t('settings.checkForUpdates')}
                            </button>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard icon={Folder} title={t('settings.enginePaths')} description={t('settings.engineDesc')}>
                    <PathList type="engine" items={paths.enginePaths} onAdd={handleAddEnginePath} onRemove={handleRemovePath} />
                </SectionCard>

                <SectionCard icon={FolderOpen} title={t('settings.projectPaths')} description={t('settings.projectDesc')}>
                    <PathList type="project" items={paths.projectPaths} onAdd={handleAddProjectPath} onRemove={handleRemovePath} />
                </SectionCard>

                <SectionCard icon={ChevronRight} title={t('settings.contextMenu')} description={t('settings.contextMenuDesc')}>
                    <div className="p-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {menuItems.map(({ key, icon: Icon, color }) => {
                                const isActive = menuConfig[key];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => toggleContextMenu(key)}
                                        className={`
                                            relative rounded-xl p-3 text-left transition-all duration-300 border group
                                            ${isActive
                                                ? 'bg-white/[0.04] border-white/10'
                                                : 'bg-white/[0.01] border-white/[0.04] hover:border-white/10 hover:bg-white/[0.03] opacity-50 hover:opacity-80'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center justify-between mb-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}>
                                                <Icon size={15} className={isActive ? color : 'text-slate-600'} />
                                            </div>
                                            <div className={`w-8 h-[18px] rounded-full relative transition-colors duration-300 ${isActive ? 'bg-[var(--accent-color)]' : 'bg-slate-700'}`}>
                                                <div className={`absolute top-[3px] left-[3px] w-3 h-3 rounded-full bg-white transition-transform duration-300 ${isActive ? 'translate-x-[14px]' : ''}`} />
                                            </div>
                                        </div>
                                        <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                                            {t(`contextMenu.${key}`)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard icon={Sparkles} title={t('settings.extraSettings')}>
                    <SettingRow label={t('settings.gitIntegration')} description={t('settings.gitIntegrationDesc')}>
                        <Toggle
                            checked={localStorage.getItem('showGitIntegration') !== 'false'}
                            onChange={(val) => {
                                localStorage.setItem('showGitIntegration', val.toString());
                                window.dispatchEvent(new Event('storage'));
                                window.location.reload();
                            }}
                        />
                    </SettingRow>
                    <SettingRow label={t('settings.diversionIntegration')} description={t('settings.diversionIntegrationDesc')}>
                        <Toggle
                            checked={localStorage.getItem('showDiversionIntegration') === 'true'}
                            onChange={(val) => {
                                localStorage.setItem('showDiversionIntegration', val.toString());
                                window.dispatchEvent(new Event('storage'));
                                window.location.reload();
                            }}
                        />
                    </SettingRow>
                </SectionCard>

            </div>
        </div>
    );
};
