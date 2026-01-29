
import React, { useState } from 'react';
import { Project, ProjectStatus, User, Task, TaskStatus, ProjectFinancials } from '../types';
import { GLOBAL_RATES } from '../services/projectAnalytics';
import Modal from './Modal';

interface PnLBoardProps {
    projects: Project[];
    users: User[];
    tasks: Task[]; // Need tasks to auto-fill
    pnlData: Record<string, ProjectFinancials>;
    onUpdatePnl: (projectId: string, data: ProjectFinancials) => void;
}

const PnLBoard: React.FC<PnLBoardProps> = ({ projects, users, tasks, pnlData, onUpdatePnl }) => {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Initialize financials if missing when opening (logic moved to parent/on-demand mostly, but fallback here)
    const getFinancials = (project: Project): ProjectFinancials => {
        if (pnlData[project.id]) return pnlData[project.id];

        // Smart Pre-fill based on Scope string
        const scopeStr = project.scope?.contentFreq || "";
        const posts = parseInt(scopeStr.match(/(\d+)\s*(?:пост|post)/i)?.[1] || "0");
        const reels = parseInt(scopeStr.match(/(\d+)\s*(?:reels|рилс)/i)?.[1] || "0");
        const stories = parseInt(scopeStr.match(/(\d+)\s*(?:сторис|stories)/i)?.[1] || "0");

        // Added missing required expenses and margin properties
        return {
            projectId: project.id,
            revenue: project.budget,
            expenses: 0,
            margin: 0,
            smmType: 'piece',
            smmFixedSalary: 0,
            cntPosts: posts,
            cntReels: reels,
            cntStories: stories,
            cntSpecDesign: 0,
            cntMonitoring: false,
            cntDubbing: 0,
            cntScenarios: 0,
            prodMobilographyHours: 0,
            prodPhotographerHours: 0,
            prodVideoCost: 0,
            prodModelsCost: 0,
            mediaSpend: project.mediaBudget || 0,
            unforeseenCost: 0
        };
    };

    const activeProjects = projects.filter(p => !p.isArchived);

    // Calculation Helper
    const calculateTotals = (fin: ProjectFinancials) => {
        let smmCost = 0;
        if (fin.smmType === 'project') {
            smmCost = fin.smmFixedSalary;
        } else {
            smmCost = (fin.cntPosts * GLOBAL_RATES.SMM.post) +
                      (fin.cntReels * GLOBAL_RATES.SMM.reel) +
                      (fin.cntStories * GLOBAL_RATES.SMM.story) +
                      (fin.cntSpecDesign * GLOBAL_RATES.SMM.specDesign) +
                      (fin.cntMonitoring ? GLOBAL_RATES.SMM.monitoring : 0) +
                      (fin.cntDubbing * GLOBAL_RATES.SMM.dubbing) +
                      (fin.cntScenarios * GLOBAL_RATES.SMM.scenario);
        }

        const productionCost = (fin.prodMobilographyHours * GLOBAL_RATES.PRODUCTION.hourly) +
                               (fin.prodPhotographerHours * GLOBAL_RATES.PRODUCTION.hourly) +
                               fin.prodVideoCost +
                               fin.prodModelsCost;

        const totalExpenses = smmCost + productionCost + fin.mediaSpend + fin.unforeseenCost;
        const netProfit = fin.revenue - totalExpenses;
        const margin = fin.revenue > 0 ? (netProfit / fin.revenue) * 100 : 0;

        return { smmCost, productionCost, totalExpenses, netProfit, margin };
    };

    const handleUpdate = (updates: Partial<ProjectFinancials>) => {
        if (!selectedProjectId) return;
        const currentData = getFinancials(projects.find(p => p.id === selectedProjectId)!);
        onUpdatePnl(selectedProjectId, { ...currentData, ...updates });
    };

    const handleSyncWithTasks = () => {
        if(!selectedProjectId) return;
        
        // Find completed tasks for this project
        const projectTasks = tasks.filter(t => t.projectId === selectedProjectId && t.status === TaskStatus.DONE);
        
        // Simple logic: check titles or tags
        const postsCount = projectTasks.filter(t => t.title.toLowerCase().includes('пост') || t.tags?.includes('Post')).length;
        const reelsCount = projectTasks.filter(t => t.title.toLowerCase().includes('reels') || t.title.toLowerCase().includes('рилс') || t.tags?.includes('Reels')).length;
        const storiesCount = projectTasks.filter(t => t.title.toLowerCase().includes('сторис') || t.title.toLowerCase().includes('stories') || t.tags?.includes('Stories')).length;

        handleUpdate({
            cntPosts: postsCount,
            cntReels: reelsCount,
            cntStories: storiesCount
        });
        alert(`Синхронизировано:\nПосты: ${postsCount}\nReels: ${reelsCount}\nStories: ${storiesCount}`);
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const selectedFin = selectedProject ? getFinancials(selectedProject) : null;
    const selectedCalcs = selectedFin ? calculateTotals(selectedFin) : null;

    return (
        <div className="p-4 md:p-6 pb-20 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">P&L (Profit & Loss)</h2>
                    <p className="text-sm text-slate-500 mt-1">Финансовый отчет по проектам</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded text-xs font-bold border border-blue-100">
                    ADMIN ACCESS ONLY
                </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 gap-4">
                {/* Header Row */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 text-xs font-bold text-slate-500 uppercase rounded-lg">
                    <div className="col-span-3">Проект</div>
                    <div className="col-span-2 text-right">Выручка</div>
                    <div className="col-span-2 text-right">Расходы</div>
                    <div className="col-span-2 text-right">Прибыль</div>
                    <div className="col-span-2 text-right">Маржа</div>
                    <div className="col-span-1"></div>
                </div>

                {activeProjects.map(project => {
                    const fin = getFinancials(project); 
                    const { totalExpenses, netProfit, margin } = calculateTotals(fin);

                    return (
                        <div 
                            key={project.id} 
                            onClick={() => setSelectedProjectId(project.id)}
                            className="bg-white border border-slate-200 rounded-xl p-4 md:grid md:grid-cols-12 md:gap-4 md:items-center hover:shadow-md transition-shadow cursor-pointer group"
                        >
                            <div className="col-span-3 mb-2 md:mb-0">
                                <h3 className="font-bold text-slate-800">{project.name}</h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded ${project.status === ProjectStatus.IN_WORK ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {project.status}
                                </span>
                            </div>
                            
                            <div className="col-span-2 flex justify-between md:block md:text-right mb-1 md:mb-0">
                                <span className="md:hidden text-xs text-slate-400">Выручка:</span>
                                <span className="font-mono font-medium text-slate-700">{fin.revenue.toLocaleString()} ₸</span>
                            </div>

                            <div className="col-span-2 flex justify-between md:block md:text-right mb-1 md:mb-0">
                                <span className="md:hidden text-xs text-slate-400">Расходы:</span>
                                <span className="font-mono font-medium text-red-500">-{Math.round(totalExpenses).toLocaleString()} ₸</span>
                            </div>

                            <div className="col-span-2 flex justify-between md:block md:text-right mb-1 md:mb-0">
                                <span className="md:hidden text-xs text-slate-400">Прибыль:</span>
                                <span className={`font-mono font-bold ${netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {Math.round(netProfit).toLocaleString()} ₸
                                </span>
                            </div>

                            <div className="col-span-2 flex justify-between md:block md:text-right mb-1 md:mb-0">
                                <span className="md:hidden text-xs text-slate-400">Маржа:</span>
                                <span className={`font-bold text-sm ${margin > 30 ? 'text-green-500' : margin > 10 ? 'text-yellow-500' : 'text-red-500'}`}>
                                    {margin.toFixed(1)}%
                                </span>
                            </div>

                            <div className="col-span-1 text-right hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg className="w-5 h-5 text-slate-400 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* EDIT MODAL */}
            {selectedProjectId && selectedFin && selectedCalcs && (
                <Modal isOpen={true} onClose={() => setSelectedProjectId(null)} title={`Финансы: ${selectedProject?.name}`} size="3xl">
                    <div className="space-y-6">
                        {/* Summary Header */}
                        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Выручка</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none text-xl font-bold text-slate-800"
                                    value={selectedFin.revenue}
                                    onChange={(e) => handleUpdate({ revenue: Number(e.target.value) })}
                                />
                            </div>
                            <div className="text-center">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Расходы</label>
                                <div className="text-xl font-bold text-red-500">-{Math.round(selectedCalcs.totalExpenses).toLocaleString()} ₸</div>
                            </div>
                            <div className="text-right">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Чистая прибыль</label>
                                <div className={`text-xl font-bold ${selectedCalcs.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {Math.round(selectedCalcs.netProfit).toLocaleString()} ₸
                                </div>
                                <div className="text-xs text-slate-500">{selectedCalcs.margin.toFixed(1)}%</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* LEFT COL: SMM Costs */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700 text-sm">Зарплата SMM</h3>
                                    <div className="flex bg-white rounded p-0.5 shadow-sm">
                                        <button 
                                            onClick={() => handleUpdate({ smmType: 'piece' })}
                                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedFin.smmType === 'piece' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}
                                        >
                                            Сдельная
                                        </button>
                                        <button 
                                            onClick={() => handleUpdate({ smmType: 'project' })}
                                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedFin.smmType === 'project' ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}
                                        >
                                            Проект
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-4 space-y-3">
                                    {selectedFin.smmType === 'project' ? (
                                        <div>
                                            <label className="text-xs text-slate-500">Фиксированная оплата</label>
                                            <input 
                                                type="number" className="w-full border border-slate-300 rounded px-2 py-1.5" 
                                                value={selectedFin.smmFixedSalary}
                                                onChange={e => handleUpdate({ smmFixedSalary: Number(e.target.value) })}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2 text-sm">
                                            {/* Table-like rows for piece rate */}
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Posts ({GLOBAL_RATES.SMM.post})</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntPosts} onChange={e => handleUpdate({ cntPosts: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntPosts * GLOBAL_RATES.SMM.post).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Reels ({GLOBAL_RATES.SMM.reel})</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntReels} onChange={e => handleUpdate({ cntReels: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntReels * GLOBAL_RATES.SMM.reel).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Stories ({GLOBAL_RATES.SMM.story})</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntStories} onChange={e => handleUpdate({ cntStories: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntStories * GLOBAL_RATES.SMM.story).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Спец. дизайн</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntSpecDesign} onChange={e => handleUpdate({ cntSpecDesign: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntSpecDesign * GLOBAL_RATES.SMM.specDesign).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Дублирование</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntDubbing} onChange={e => handleUpdate({ cntDubbing: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntDubbing * GLOBAL_RATES.SMM.dubbing).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-5 text-slate-600">Сценарии</div>
                                                <input className="col-span-3 border rounded px-1 text-center" type="number" value={selectedFin.cntScenarios} onChange={e => handleUpdate({ cntScenarios: Number(e.target.value) })} />
                                                <div className="col-span-4 text-right font-bold">{(selectedFin.cntScenarios * GLOBAL_RATES.SMM.scenario).toLocaleString()}</div>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-1.5 rounded">
                                                <div className="col-span-8 text-slate-600">Мониторинг ({GLOBAL_RATES.SMM.monitoring})</div>
                                                <div className="col-span-4 text-right flex justify-end items-center gap-2">
                                                    <input type="checkbox" checked={selectedFin.cntMonitoring} onChange={e => handleUpdate({ cntMonitoring: e.target.checked })} />
                                                    <span className="font-bold">{selectedFin.cntMonitoring ? GLOBAL_RATES.SMM.monitoring.toLocaleString() : 0}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleSyncWithTasks}
                                                className="w-full text-center text-xs text-blue-600 border border-blue-200 rounded py-1 hover:bg-blue-50 transition-colors"
                                            >
                                                🔄 Заполнить из выполненных задач
                                            </button>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                                        <span>Итого SMM:</span>
                                        <span>{selectedCalcs.smmCost.toLocaleString()} ₸</span>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COL: Production & Other */}
                            <div className="space-y-4">
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                        <h3 className="font-bold text-slate-700 text-sm">Продакшн ({GLOBAL_RATES.PRODUCTION.hourly.toLocaleString()}/час)</h3>
                                    </div>
                                    <div className="p-4 space-y-3 text-sm">
                                        <div className="flex justify-between items-center">
                                            <label className="text-slate-600">Мобилограф (часов)</label>
                                            <div className="flex items-center gap-2">
                                                <input className="w-16 border rounded px-1 text-center" type="number" value={selectedFin.prodMobilographyHours} onChange={e => handleUpdate({ prodMobilographyHours: Number(e.target.value) })} />
                                                <span className="w-20 text-right font-bold text-slate-700">{(selectedFin.prodMobilographyHours * GLOBAL_RATES.PRODUCTION.hourly).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label className="text-slate-600">Фотограф (часов)</label>
                                            <div className="flex items-center gap-2">
                                                <input className="w-16 border rounded px-1 text-center" type="number" value={selectedFin.prodPhotographerHours} onChange={e => handleUpdate({ prodPhotographerHours: Number(e.target.value) })} />
                                                <span className="w-20 text-right font-bold text-slate-700">{(selectedFin.prodPhotographerHours * GLOBAL_RATES.PRODUCTION.hourly).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="border-t border-slate-100 pt-2">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-slate-600">Проф. видео (Сумма)</label>
                                                <input className="w-24 border rounded px-1 text-right font-bold" type="number" value={selectedFin.prodVideoCost} onChange={e => handleUpdate({ prodVideoCost: Number(e.target.value) })} />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <label className="text-slate-600">Модели (Сумма)</label>
                                                <input className="w-24 border rounded px-1 text-right font-bold" type="number" value={selectedFin.prodModelsCost} onChange={e => handleUpdate({ prodModelsCost: Number(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-800">
                                            <span>Итого Продакшн:</span>
                                            <span>{selectedCalcs.productionCost.toLocaleString()} ₸</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                                        <h3 className="font-bold text-slate-700 text-sm">Прочие расходы</h3>
                                    </div>
                                    <div className="p-4 space-y-3 text-sm">
                                        <div className="flex justify-between items-center">
                                            <label className="text-slate-600">Рекламный бюджет (Медиа)</label>
                                            <input className="w-28 border rounded px-1 text-right font-bold" type="number" value={selectedFin.mediaSpend} onChange={e => handleUpdate({ mediaSpend: Number(e.target.value) })} />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <label className="text-slate-600">Непредвиденные (Такси и др)</label>
                                            <input className="w-28 border rounded px-1 text-right font-bold" type="number" value={selectedFin.unforeseenCost} onChange={e => handleUpdate({ unforeseenCost: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PnLBoard;
