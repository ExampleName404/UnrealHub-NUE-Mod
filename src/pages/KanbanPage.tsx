import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KanbanSquare, Image as ImageIcon, ArrowLeft, ListChecks } from 'lucide-react';
import { ProjectKanban } from '../components/Projects/ProjectKanban';
import { useProjects } from '../hooks/useProjects';
import type { KanbanBoard } from '../types';

const STORAGE_KEY = 'kanban_selected_project_path';

const countCards = (board: KanbanBoard | undefined): number => {
    if (!board?.lists) return 0;
    return board.lists.reduce((sum, list) => sum + (list.cards?.length || 0), 0);
};

export const KanbanPage: React.FC = () => {
    const { t } = useTranslation();
    const { projects } = useProjects();
    const [boards, setBoards] = useState<Record<string, KanbanBoard>>({});
    const [loaded, setLoaded] = useState(false);
    const [selectedPath, setSelectedPath] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await window.unreal.getAllProjectKanbans();
                if (!cancelled) setBoards(data || {});
            } catch (e) {
                console.error('Failed to load kanban boards', e);
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Reload boards each time we return from a project view, so card counts stay fresh.
    const reloadBoards = async () => {
        try {
            const data = await window.unreal.getAllProjectKanbans();
            setBoards(data || {});
        } catch { /* ignore */ }
    };

    useEffect(() => {
        if (selectedPath) localStorage.setItem(STORAGE_KEY, selectedPath);
    }, [selectedPath]);

    const projectsWithKanban = useMemo(() => {
        return projects
            .filter(p => p.path in boards)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [projects, boards]);

    const selectedProject = projectsWithKanban.find(p => p.path === selectedPath);

    // ── Detailed kanban view ────────────────────────────────────────
    if (selectedProject) {
        return (
            <div className="w-full h-full flex flex-col">
                <div className="mb-4 flex items-center gap-3">
                    <button
                        onClick={async () => {
                            await reloadBoards();
                            setSelectedPath('');
                        }}
                        className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-colors"
                        title={t('kanban.backToList')}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-white/[0.06] flex items-center justify-center">
                        {selectedProject.thumbnail ? (
                            <img src={selectedProject.thumbnail} alt={selectedProject.name} className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon size={20} className="text-slate-600" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('kanban.projectLabel')}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <h3 className="text-lg font-bold text-white truncate max-w-[420px]" title={selectedProject.name}>
                                {selectedProject.name}
                            </h3>
                            {selectedProject.version && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-800/60 text-slate-300 border border-white/10 whitespace-nowrap">
                                    UE {selectedProject.version}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-600 font-mono truncate max-w-[500px]" title={selectedProject.path}>
                            {selectedProject.path}
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0 bg-slate-900/40 border border-white/[0.04] rounded-2xl overflow-hidden">
                    <ProjectKanban projectPath={selectedProject.path} />
                </div>
            </div>
        );
    }

    // ── Tile picker ─────────────────────────────────────────────────
    return (
        <div className="w-full h-full flex flex-col">
            <div className="mb-6">
                <h2 className="text-3xl font-black text-white tracking-tight">
                    {t('kanban.title').toUpperCase()}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                    {t('kanban.pickerSubtitle')}
                </p>
            </div>

            {loaded && projectsWithKanban.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <KanbanSquare size={48} className="text-slate-700 mb-4" />
                    <h3 className="text-base font-bold text-slate-300 mb-1">{t('kanban.emptyTitle')}</h3>
                    <p className="text-sm text-slate-500 max-w-md">{t('kanban.emptyHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {projectsWithKanban.map(project => {
                        const cardCount = countCards(boards[project.path]);
                        const listCount = boards[project.path]?.lists?.length || 0;
                        return (
                            <button
                                key={project.path}
                                onClick={() => setSelectedPath(project.path)}
                                className="group text-left bg-slate-900/60 border border-white/[0.04] hover:border-[var(--accent-color)]/40 hover:bg-slate-900/80 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-[var(--accent-color)]/10"
                            >
                                <div className="aspect-[16/9] bg-slate-800 relative overflow-hidden">
                                    {project.thumbnail ? (
                                        <img
                                            src={project.thumbnail}
                                            alt={project.name}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon size={32} className="text-slate-700" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    {project.version && (
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-black/60 text-white backdrop-blur-md border border-white/10">
                                            UE {project.version}
                                        </span>
                                    )}
                                </div>
                                <div className="p-4">
                                    <h4 className="font-bold text-white truncate group-hover:text-[var(--accent-color)] transition-colors" title={project.name}>
                                        {project.name}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                            <ListChecks size={12} />
                                            {t('kanban.cardCount', { count: cardCount, defaultValue: `${cardCount} cards` })}
                                        </span>
                                        <span>·</span>
                                        <span>
                                            {t('kanban.listCount', { count: listCount, defaultValue: `${listCount} lists` })}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
