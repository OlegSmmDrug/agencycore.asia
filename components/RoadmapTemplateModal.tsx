
import React, { useState } from 'react';
import { ROADMAP_TEMPLATES } from '../constants';
import { RoadmapTemplate } from '../types';

interface RoadmapTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: RoadmapTemplate) => void;
  projectName: string;
}

const RoadmapTemplateModal: React.FC<RoadmapTemplateModalProps> = ({ isOpen, onClose, onSelect, projectName }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<RoadmapTemplate | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"
        >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {!selectedTemplate ? (
            // VIEW 1: Template Selection
            <div className="flex flex-col h-full">
                <div className="p-8 pb-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Создать дорожную карту</h2>
                    <p className="text-slate-500">Выберите шаблон для проекта "{projectName}"</p>
                    <p className="text-xs text-slate-400 mt-1">Шаблон развернёт готовую структуру этапов и задач для управления проектом</p>
                </div>

                <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {ROADMAP_TEMPLATES.map(template => (
                            <div 
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                className="border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group bg-white"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="text-4xl group-hover:scale-110 transition-transform duration-300">{template.icon}</div>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{template.name}</h3>
                                <p className="text-sm text-slate-500 mb-6 line-clamp-2">{template.description}</p>
                                <div className="flex items-center text-xs font-medium text-slate-400 border-t border-slate-100 pt-4">
                                    <span>{template.totalStages} этапов, {template.totalTasks} задач</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ) : (
            // VIEW 2: Template Preview
            <div className="flex flex-col h-full">
                <div className="p-6 border-b border-slate-100 flex items-center space-x-4">
                    <button onClick={() => setSelectedTemplate(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">{selectedTemplate.icon}</span>
                        <h2 className="text-xl font-bold text-slate-800">{selectedTemplate.name}</h2>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-center font-bold text-slate-800 mb-6 text-lg">Этапы шаблона "{selectedTemplate.name}":</h3>
                        <div className="space-y-6">
                            {selectedTemplate.stages.map((stage, idx) => (
                                <div key={idx} className="relative pl-8">
                                    <div className="absolute left-2 top-2 w-0.5 h-full bg-blue-100 last:bg-transparent"></div>
                                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-blue-50 border-2 border-blue-500 flex items-center justify-center text-[8px] font-bold text-blue-600 z-10">
                                        {idx + 1}
                                    </div>
                                    <h4 className="font-bold text-slate-800 mb-2">{stage.name} <span className="text-slate-400 font-normal text-sm ml-1">({stage.tasks.length} задач)</span></h4>
                                    <ul className="space-y-2">
                                        {stage.tasks.map((task, tIdx) => (
                                            <li key={tIdx} className="text-sm text-slate-600 flex items-center">
                                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-2"></span>
                                                {task}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
                    <button 
                        onClick={() => setSelectedTemplate(null)}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                    >
                        Отмена
                    </button>
                    <button 
                        onClick={() => onSelect(selectedTemplate)}
                        className="px-8 py-2.5 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all"
                    >
                        Создать дорожную карту
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapTemplateModal;
