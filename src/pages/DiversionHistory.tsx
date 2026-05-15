import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, AlertCircle, Clock, RefreshCcw, Download, Terminal, GitCommit, Plus, Pencil, Minus, GitBranch, ChevronRight } from 'lucide-react';
import type { DiversionCommit, DiversionStatusCounts, DiversionChangedFile } from '../types';

interface DiversionHistoryPageProps {
    projectPath: string;
    projectName: string;
    onBack: () => void;
    embedded?: boolean;
    /** Which section to render. Default 'both' = legacy stand-alone layout. */
    view?: 'both' | 'history' | 'changes';
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
    | {
        kind: 'ready';
        commits: DiversionCommit[];
        counts: DiversionStatusCounts | null;
        files: DiversionChangedFile[];
        rawLog: string;
    };

export const DiversionHistoryPage: React.FC<DiversionHistoryPageProps> = ({ projectPath, projectName, onBack, embedded, view = 'both' }) => {
    const { t } = useTranslation();
    const showChanges = view === 'both' || view === 'changes';
    const showHistory = view === 'both' || view === 'history';
    const [state, setState] = useState<ViewState>({ kind: 'loading' });
    const [showRaw, setShowRaw] = useState(false);
    const [commitOpen, setCommitOpen] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [committing, setCommitting] = useState(false);
    const [branches, setBranches] = useState<string[]>([]);
    const [currentBranch, setCurrentBranch] = useState('');
    const [branchError, setBranchError] = useState<string | null>(null);
    const [switchingBranch, setSwitchingBranch] = useState(false);
    const isLoading = state.kind === 'loading';

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

            const [historyRes, statusRes, branchRes] = await Promise.all([
                window.unreal.diversionGetHistory(projectPath, 200),
                window.unreal.diversionGetStatus(projectPath),
                window.unreal.diversionGetBranches(projectPath),
            ]);

            if (branchRes.error) {
                setBranches([]);
                setCurrentBranch('');
                setBranchError(branchRes.error);
            } else {
                setBranches(branchRes.branches);
                setCurrentBranch(branchRes.current);
                setBranchError(null);
            }

            if (historyRes.error) {
                setState({ kind: 'error', error: historyRes.error, rawLog: historyRes.raw });
                return;
            }

            setState({
                kind: 'ready',
                commits: historyRes.commits,
                counts: statusRes.error ? null : statusRes.counts,
                files: statusRes.error ? [] : (statusRes.files || []),
                rawLog: historyRes.raw,
            });
        } catch (e: any) {
            setState({ kind: 'error', error: e?.message || 'unknown error' });
        }
    }, [projectPath]);

    useEffect(() => {
        reload();
    }, [reload]);

    const handleSwitchBranch = async (branchName: string) => {
        if (!branchName || branchName === currentBranch || switchingBranch) return;
        setSwitchingBranch(true);
        try {
            const res = await window.unreal.diversionCheckoutBranch(projectPath, branchName);
            if (res.success) {
                await reload();
            } else {
                alert(t('diversion.branchSwitchFailed', { error: res.error || 'unknown' }));
            }
        } catch (e: any) {
            alert(t('diversion.branchSwitchFailed', { error: e?.message || 'unknown' }));
        } finally {
            setSwitchingBranch(false);
        }
    };

    const handleCommit = async () => {
        const msg = commitMessage.trim();
        if (!msg || committing) return;
        setCommitting(true);
        try {
            const res = await window.unreal.diversionCommit(projectPath, msg);
            if (res.success) {
                setCommitMessage('');
                setCommitOpen(false);
                await reload();
            } else {
                alert(t('diversion.commitFailed', { error: res.error || 'unknown' }));
            }
        } catch (e: any) {
            alert(t('diversion.commitFailed', { error: e?.message || 'unknown' }));
        } finally {
            setCommitting(false);
        }
    };

    const hasStatus = useMemo(() => {
        if (state.kind !== 'ready' || !state.counts) return false;
        return state.counts.new + state.counts.modified + state.counts.deleted > 0;
    }, [state]);

    return (
        <div className={embedded ? 'w-full' : 'w-full max-w-5xl mx-auto py-6 px-4'}>
            {!embedded && (
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
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-color)] hover:brightness-110 disabled:opacity-50 text-white text-sm transition-all"
                        >
                            <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                            {t('diversion.refresh')}
                        </button>
                    </div>
                </div>
            )}

            {embedded && state.kind === 'ready' && (
                <div className="flex items-center justify-end gap-2 mb-4">
                    {showHistory && (
                        <button
                            onClick={() => setShowRaw(s => !s)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white text-xs transition-colors"
                        >
                            <Terminal size={12} />
                            {showRaw ? t('diversion.hideRaw') : t('diversion.showRaw')}
                        </button>
                    )}
                    <button
                        onClick={reload}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:brightness-110 disabled:opacity-50 text-white text-xs transition-all"
                    >
                        <RefreshCcw size={12} className={isLoading ? 'animate-spin' : ''} />
                        {t('diversion.refresh')}
                    </button>
                </div>
            )}

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
                        href="https://get.diversion.dev/win"
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
                    {branches.length > 0 && (
                        <div className="mb-4 flex items-center gap-3 bg-slate-900/40 border border-white/[0.04] rounded-xl px-4 py-2.5">
                            <GitBranch size={14} className="text-slate-500 shrink-0" />
                            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 shrink-0">
                                {t('diversion.branchSelectorLabel')}
                            </span>
                            <div className="relative flex-1 max-w-[360px]">
                                <select
                                    value={currentBranch}
                                    onChange={(e) => handleSwitchBranch(e.target.value)}
                                    disabled={switchingBranch}
                                    className="appearance-none w-full bg-slate-800/60 border border-white/[0.06] hover:border-white/[0.12] focus:border-[var(--accent-color)] focus:outline-none rounded-lg pl-3 pr-9 py-1.5 text-sm font-medium text-slate-200 cursor-pointer transition-colors disabled:opacity-50"
                                >
                                    {!branches.includes(currentBranch) && currentBranch && (
                                        <option value={currentBranch}>{currentBranch}</option>
                                    )}
                                    {branches.map(b => (
                                        <option key={b} value={b}>
                                            {b}{b === currentBranch ? '  ✓' : ''}
                                        </option>
                                    ))}
                                </select>
                                <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                            </div>
                            {switchingBranch && (
                                <span className="text-[11px] text-slate-500">{t('diversion.branchSwitching')}</span>
                            )}
                        </div>
                    )}
                    {branchError && branches.length === 0 && (
                        <div className="mb-4 px-3 py-2 rounded-lg bg-slate-900/40 border border-amber-500/15 text-[11px] text-amber-300/70 font-mono">
                            {t('diversion.branchListFailed', { error: branchError })}
                        </div>
                    )}
                    {showChanges && state.counts && !hasStatus && (
                        <div className="bg-slate-900/60 border border-white/[0.04] rounded-2xl p-6 text-center">
                            <p className="text-sm text-slate-400">{t('diversion.noChanges')}</p>
                            <p className="text-[11px] text-slate-600 mt-2">{t('diversion.noChangesHint')}</p>
                        </div>
                    )}
                    {showChanges && hasStatus && state.counts && (
                        <div className="mb-6 bg-slate-900/60 border border-white/[0.04] rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-3 gap-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('diversion.statusHeader')}
                                </div>
                                <button
                                    onClick={() => setCommitOpen(s => !s)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] hover:brightness-110 text-white text-xs font-bold transition-all"
                                >
                                    <GitCommit size={13} />
                                    {commitOpen ? t('diversion.cancelCommit') : t('diversion.commit')}
                                </button>
                            </div>
                            <div className="flex items-center gap-6 text-sm mb-3">
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

                            {state.files.length > 0 && (
                                <div className="mt-3 max-h-[220px] overflow-auto rounded-lg border border-white/[0.04] bg-slate-950/40">
                                    {state.files.map((f, idx) => {
                                        const Icon = f.kind === 'new' ? Plus : f.kind === 'modified' ? Pencil : Minus;
                                        const colour = f.kind === 'new'
                                            ? 'text-emerald-400'
                                            : f.kind === 'modified'
                                                ? 'text-amber-400'
                                                : 'text-red-400';
                                        return (
                                            <div
                                                key={`${f.kind}:${f.path}:${idx}`}
                                                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono text-slate-400 hover:bg-white/[0.02]"
                                                title={f.path}
                                            >
                                                <Icon size={11} className={colour + ' shrink-0'} />
                                                <span className="truncate">{f.path}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {commitOpen && (
                                <div className="mt-4 pt-4 border-t border-white/[0.04]">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                        {t('diversion.commitMessage')}
                                    </label>
                                    <textarea
                                        autoFocus
                                        value={commitMessage}
                                        onChange={(e) => setCommitMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit();
                                            if (e.key === 'Escape' && !committing) setCommitOpen(false);
                                        }}
                                        placeholder={t('diversion.commitPlaceholder')}
                                        rows={3}
                                        className="w-full px-3 py-2 bg-slate-800/70 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--accent-color)] font-mono resize-y"
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[10px] text-slate-600">{t('diversion.commitHint')}</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => !committing && setCommitOpen(false)}
                                                disabled={committing}
                                                className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg transition-all border border-white/5"
                                            >
                                                {t('diversion.cancelCommit')}
                                            </button>
                                            <button
                                                onClick={handleCommit}
                                                disabled={committing || !commitMessage.trim()}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all bg-[var(--accent-color)] text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <GitCommit size={12} />
                                                {committing ? '...' : t('diversion.commit')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showHistory && (showRaw ? (
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
                    ))}
                </>
            )}
        </div>
    );
};
