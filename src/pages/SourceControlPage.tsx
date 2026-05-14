import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Image as ImageIcon, GitBranch, GitCommit, History, ListChecks } from 'lucide-react';
import { GitHistoryPage } from './GitHistory';
import { DiversionHistoryPage } from './DiversionHistory';
import type { Project, ProjectVcsPref } from '../types';

interface SourceControlPageProps {
    project: Project;
    onBack: () => void;
}

type TabKey = 'git-history' | 'diversion-history' | 'diversion-changes';

function resolveEnabledVcs(pref: ProjectVcsPref | undefined, defaults: { git: boolean; diversion: boolean }): { git: boolean; diversion: boolean } {
    return {
        git: pref?.git ? pref.git === 'on' : defaults.git,
        diversion: pref?.diversion ? pref.diversion === 'on' : defaults.diversion,
    };
}

export const SourceControlPage: React.FC<SourceControlPageProps> = ({ project, onBack }) => {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState<{ git: boolean; diversion: boolean }>({ git: true, diversion: false });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const prefs = await window.unreal.getProjectVcsPrefs();
                const defaults = {
                    git: localStorage.getItem('showGitIntegration') !== 'false',
                    diversion: localStorage.getItem('showDiversionIntegration') === 'true',
                };
                const resolved = resolveEnabledVcs(prefs[project.path], defaults);
                if (!cancelled) {
                    setEnabled(resolved);
                    // Pick first enabled tab as default
                    if (resolved.git) setActiveTab('git-history');
                    else if (resolved.diversion) setActiveTab('diversion-changes');
                }
            } catch (e) {
                console.error('Failed to resolve VCS prefs', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [project.path]);

    const tabs = useMemo(() => {
        const list: { key: TabKey; label: string; icon: React.ElementType }[] = [];
        if (enabled.git) list.push({ key: 'git-history', label: t('sourceControl.tabGitHistory'), icon: GitBranch });
        if (enabled.diversion) {
            list.push({ key: 'diversion-changes', label: t('sourceControl.tabDiversionChanges'), icon: ListChecks });
            list.push({ key: 'diversion-history', label: t('sourceControl.tabDiversionHistory'), icon: History });
        }
        return list;
    }, [enabled, t]);

    return (
        <div className="w-full h-full flex flex-col">
            {/* Shared header */}
            <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors shrink-0"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-white/[0.06] flex items-center justify-center">
                        {project.thumbnail ? (
                            <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon size={20} className="text-slate-600" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('sourceControl.title')}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <h2 className="text-lg font-bold text-white truncate max-w-[420px]" title={project.name}>
                                {project.name}
                            </h2>
                            {project.version && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-800/60 text-slate-300 border border-white/10 whitespace-nowrap">
                                    UE {project.version}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            {tabs.length > 0 && (
                <div className="mb-4 flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl border border-white/[0.04] self-start">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    active
                                        ? 'bg-[var(--accent-color)] text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {loading ? (
                    <div className="text-center text-slate-500 py-12 text-sm">{t('sourceControl.loading')}</div>
                ) : tabs.length === 0 ? (
                    <div className="bg-slate-900/60 border border-white/[0.04] rounded-2xl p-8 text-center">
                        <p className="text-sm text-slate-400">{t('sourceControl.noVcsEnabled')}</p>
                        <p className="text-[11px] text-slate-600 mt-2">{t('sourceControl.noVcsHint')}</p>
                    </div>
                ) : activeTab === 'git-history' ? (
                    <div className="h-full">
                        <GitHistoryPage
                            projectPath={project.path}
                            projectName={project.name}
                            onBack={onBack}
                            embedded
                        />
                    </div>
                ) : activeTab === 'diversion-changes' ? (
                    <DiversionHistoryPage
                        projectPath={project.path}
                        projectName={project.name}
                        onBack={onBack}
                        embedded
                        view="changes"
                    />
                ) : activeTab === 'diversion-history' ? (
                    <DiversionHistoryPage
                        projectPath={project.path}
                        projectName={project.name}
                        onBack={onBack}
                        embedded
                        view="history"
                    />
                ) : null}
            </div>
        </div>
    );
};
