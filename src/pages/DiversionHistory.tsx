import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertCircle, Clock, RefreshCcw, Download, Terminal } from 'lucide-react';
import type { DiversionCommit, DiversionStatusCounts } from '../types';

interface DiversionHistoryPageProps {
    projectPath: string;
    projectName: string;
    onBack: () => void;
}

const formatRelativeDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

type ViewState =
    | { kind: 'loading' }
    | { kind: 'noCli'; error?: string }
    | { kind: 'notRepo' }
    | { kind: 'error'; error: string; rawLog?: string }
    | { kind: 'ready'; commits: DiversionCommit[]; counts: DiversionStatusCounts | null; rawLog: string };

export const DiversionHistoryPage: React.FC<DiversionHistoryPageProps> = ({ projectPath, projectName, onBack }) => {
    const { t } = useTranslation();
    const [state, setState] = useState<ViewState>({ kind: 'loading' });
    const [showRaw, setShowRaw] = useState(false);

    const reload = useCallback(async () => {
        setState({ kind: 'loading' });
        try {
            const cliRes = await window.unreal.diversionCheckCli();
            if (!cliRes.available) {
                setState({ kind: 'noCli', error: cliRes.error });
                return;
            }

            const isRepo = await window.unreal.diversionCheckRepo(projectPath);
            if (!isRepo) {
                setState({ kind: 'notRepo' });
                return;
            }

            const [historyRes, statusRes] = await Promise.all([
                window.unreal.diversionGetHistory(projectPath, 200),
                window.unreal.diversionGetStatus(projectPath),
            ]);

            if (historyRes.error) {
                setState({ kind: 'error', error: historyRes.error, rawLog: historyRes.raw });
                return;
            }

            setState({
                kind: 'ready',
                commits: historyRes.commits,
                counts: statusRes.error ? null : statusRes.counts,
                rawLog: historyRes.raw,
            });
        } catch (e: any) {
            setState({ kind: 'error', error: e?.message || 'unknown error' });
        }
    }, [projectPath]);

    useEffect(() => {
        reload();
    }, [reload]);

    const hasStatus = useMemo(() => {
        if (state.kind !== 'ready' || !state.counts) return false;
        return state.counts.new + state.counts.modified + state.counts.deleted > 0;
    }, [state]);

    return (
        <div className="w-full max-w-5xl mx-auto py-6 px-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {t('diversion.title')}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">{projectName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {state.kind === 'ready' && (
                        <button
                            onClick={() => setShowRaw(s => !s)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white text-sm transition-colors"
                        >
                            <Terminal size={14} />
                            {showRaw ? t('diversion.hideRaw') : t('diversion.showRaw')}
                        </button>
                    )}
                    <button
                        onClick={reload}
                        disabled={state.kind === 'loading'}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-color)] hover:brightness-110 disabled:opacity-50 text-white text-sm transition-all"
                    >
                        <RefreshCcw size={14} className={state.kind === 'loading' ? 'animate-spin' : ''} />
                        {t('diversion.refresh')}
                    </button>
                </div>
            </div>

            {state.kind === 'loading' && (
                <div className="text-center text-slate-500 py-12 text-sm">
                    {t('diversion.loading')}
                </div>
            )}

            {state.kind === 'noCli' && (
                <div className="bg-slate-900/60 border border-white/[0.04] rounded-2xl p-8 text-center">
                    <Download size={28} className="text-slate-500 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-200 mb-2">{t('diversion.cliMissingTitle')}</h3>
                    <p className="text-sm text-slate-400 mb-4">{t('diversion.cliMissingDesc')}</p>
                    {state.error && (
                        <p className="text-xs text-slate-600 font-mono break-words">{state.error}</p>
                    )}
                    <a
                        href="https://diversion.dev/downloads"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-block mt-5 px-4 py-2 rounded-lg bg-[var(--accent-color)] hover:brightness-110 text-white text-sm font-bold transition-all"
                    >
                        {t('diversion.cliDownload')}
                    </a>
                </div>
            )}

            {state.kind === 'notRepo' && (
                <div className="bg-slate-900/60 border border-white/[0.04] rounded-2xl p-8 text-center">
                    <AlertCircle size={28} className="text-slate-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">{t('diversion.notRepo')}</p>
                    <p className="text-[11px] text-slate-600 mt-2 font-mono">
                        {t('diversion.notRepoHint')}
                    </p>
                </div>
            )}

            {state.kind === 'error' && (
                <div className="bg-slate-900/60 border border-red-500/20 rounded-2xl p-8">
                    <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-300 text-center mb-3">
                        {t('diversion.loadFailed', { error: state.error })}
                    </p>
                    {state.rawLog && (
                        <pre className="mt-4 text-[11px] text-slate-500 font-mono whitespace-pre-wrap bg-slate-950/40 border border-white/[0.04] rounded-lg p-4 max-h-[300px] overflow-auto">
                            {state.rawLog}
                        </pre>
                    )}
                </div>
            )}

            {state.kind === 'ready' && (
                <>
                    {hasStatus && state.counts && (
                        <div className="mb-6 bg-slate-900/60 border border-white/[0.04] rounded-2xl p-4">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                                {t('diversion.statusHeader')}
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                                <div>
                                    <span className="text-emerald-400 font-bold">{state.counts.new}</span>
                                    <span className="text-slate-500 ml-1.5">{t('diversion.statusNew')}</span>
                                </div>
                                <div>
                                    <span className="text-amber-400 font-bold">{state.counts.modified}</span>
                                    <span className="text-slate-500 ml-1.5">{t('diversion.statusModified')}</span>
                                </div>
                                <div>
                                    <span className="text-red-400 font-bold">{state.counts.deleted}</span>
                                    <span className="text-slate-500 ml-1.5">{t('diversion.statusDeleted')}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {showRaw ? (
                        <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap bg-slate-950/40 border border-white/[0.04] rounded-2xl p-5 max-h-[600px] overflow-auto">
                            {state.rawLog || '(empty)'}
                        </pre>
                    ) : state.commits.length === 0 ? (
                        <div className="text-center text-slate-500 py-12 text-sm">
                            {t('diversion.noCommits')}
                        </div>
                    ) : (
                        <div className="bg-slate-900/60 border border-white/[0.04] rounded-2xl overflow-hidden divide-y divide-white/[0.03]">
                            {state.commits.map((commit, idx) => {
                                const id = commit.id || '';
                                return (
                                    <div key={id || idx} className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                                        <div className="w-9 h-9 rounded-full bg-[var(--accent-color)]/15 border border-[var(--accent-color)]/20 flex items-center justify-center shrink-0 mt-0.5">
                                            <Clock size={14} className="text-[var(--accent-color)]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm text-slate-200 font-medium" title={commit.message}>
                                                {commit.message || <span className="text-slate-500 italic">{t('diversion.noMessage')}</span>}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                {commit.author && <span>{commit.author}</span>}
                                                {commit.date && <span>{formatRelativeDate(commit.date)}</span>}
                                                {id && <span className="font-mono">{id.slice(0, 10)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
