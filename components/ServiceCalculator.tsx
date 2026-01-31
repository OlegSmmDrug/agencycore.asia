
import React, { useState, useMemo, useEffect } from 'react';
import { calculatorService } from '../services/calculatorService';
import { calculatorCategoryService, CalculatorCategory } from '../services/calculatorCategoryService';

export interface CalculatorResult {
    total: number;
    description: string;
    items: Array<{ name: string; price: number; quantity?: number; serviceId?: string }>;
}

export type ServiceType = 'checkbox' | 'counter' | 'range';

export interface ServiceItem {
    id: string;
    name: string;
    price: number;
    costPrice?: number;
    type: ServiceType;
    icon: string;
    max?: number;
    category: string;
}

interface ServiceCalculatorProps {
    onSelect?: (result: CalculatorResult) => void;
    onClose?: () => void;
}

const ServiceCalculator: React.FC<ServiceCalculatorProps> = ({ onSelect, onClose }) => {
    const [categories, setCategories] = useState<CalculatorCategory[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [isEditMode, setIsEditMode] = useState(false);
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [selections, setSelections] = useState<Record<string, number>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<ServiceItem>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [categoryForm, setCategoryForm] = useState<Partial<CalculatorCategory>>({});

    useEffect(() => {
        console.log('🎨 ServiceCalculator mounted, starting initialization...');
        const storedUser = localStorage.getItem('currentUser');
        console.log('👤 Current user from localStorage:', storedUser);

        const init = async () => {
            console.log('📥 Loading calculator data...');
            await loadCategories();
            await loadServices();
            console.log('✅ Calculator initialization complete');
        };
        init();

        const unsubscribeServices = calculatorService.subscribeToChanges((updatedServices) => {
            console.log('🔄 Services updated via subscription:', updatedServices.length);
            setServices(updatedServices);
        });

        const unsubscribeCategories = calculatorCategoryService.subscribeToChanges((updatedCategories) => {
            console.log('🔄 Categories updated via subscription:', updatedCategories.length);
            setCategories(updatedCategories);
        });

        return () => {
            console.log('🎨 ServiceCalculator unmounting...');
            unsubscribeServices();
            unsubscribeCategories();
        };
    }, []);

    const loadCategories = async () => {
        try {
            console.log('🔍 Fetching categories from service...');
            const data = await calculatorCategoryService.getAll();
            console.log('📊 Categories received:', data.length, data);
            setCategories(data);
            if (data.length > 0 && !activeTab) {
                console.log('🎯 Setting active tab to:', data[0].id);
                setActiveTab(data[0].id);
            }
        } catch (error) {
            console.error('❌ Failed to load calculator categories:', error);
        }
    };

    const loadServices = async () => {
        try {
            console.log('🔍 Fetching services from service...');
            const data = await calculatorService.getAll();
            console.log('📊 Services received:', data.length, data);
            setServices(data);
        } catch (error) {
            console.error('❌ Failed to load calculator services:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const totals = useMemo(() => {
        const res: Record<string, number> = { grand: 0 };
        categories.forEach(cat => {
            res[cat.id] = 0;
        });
        services.forEach(srv => {
            const qty = selections[srv.id] || 0;
            const cost = srv.price * qty;
            if (res[srv.category] !== undefined) {
                res[srv.category] += cost;
            }
            res.grand += cost;
        });
        return res;
    }, [services, selections, categories]);

    const updateSelection = (id: string, value: number) => {
        setSelections(prev => ({ ...prev, [id]: value }));
    };

    const handleApply = () => {
        if (!onSelect) return;
        const items: any[] = [];
        let description = "";
        services.forEach(srv => {
            const qty = selections[srv.id] || 0;
            if (qty > 0) {
                items.push({ name: srv.name, price: srv.price * qty, quantity: qty, serviceId: srv.id });
                description += `• ${srv.name}: ${qty}\n`;
            }
        });
        onSelect({ total: totals.grand, description, items });
    };

    const startEditing = (srv?: ServiceItem) => {
        if (srv) {
            setEditingId(srv.id);
            setEditForm(srv);
        } else {
            setEditingId('new');
            setEditForm({ name: '', price: 10000, type: 'checkbox', icon: '✨', category: activeTab, max: 10 });
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const saveEdit = async () => {
        if (!editForm.name || !editForm.name.trim()) {
            alert('Пожалуйста, укажите название услуги');
            return;
        }
        if (!editForm.price || editForm.price <= 0) {
            alert('Пожалуйста, укажите цену больше 0');
            return;
        }
        if (!editForm.icon || !editForm.icon.trim()) {
            alert('Пожалуйста, выберите иконку');
            return;
        }

        try {
            if (editingId === 'new') {
                const serviceToCreate = {
                    name: editForm.name,
                    price: editForm.price,
                    type: editForm.type || 'checkbox',
                    icon: editForm.icon,
                    category: editForm.category || activeTab,
                    max: editForm.max
                };
                await calculatorService.create(serviceToCreate);
            } else {
                await calculatorService.update(editingId!, editForm);
            }
            cancelEdit();
            await loadServices();
        } catch (error) {
            console.error('Failed to save service:', error);
            alert('Ошибка при сохранении услуги: ' + (error as any).message);
        }
    };

    const deleteService = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Вы уверены, что хотите удалить эту услугу?')) {
            try {
                await calculatorService.delete(id);
                setSelections(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                await loadServices();
            } catch (error) {
                console.error('Failed to delete service:', error);
                alert('Ошибка при удалении услуги');
            }
        }
    };

    const startEditingCategory = (cat?: CalculatorCategory) => {
        if (cat) {
            setEditingCategoryId(cat.id);
            setCategoryForm(cat);
        } else {
            setEditingCategoryId('new');
            setCategoryForm({
                id: `cat_${Date.now()}`,
                name: '',
                icon: '📁',
                color: '#3b82f6'
            });
        }
    };

    const cancelEditCategory = () => {
        setEditingCategoryId(null);
        setCategoryForm({});
    };

    const saveCategory = async () => {
        if (!categoryForm.name || !categoryForm.name.trim()) {
            alert('Пожалуйста, укажите название раздела');
            return;
        }
        if (!categoryForm.id || !categoryForm.id.trim()) {
            alert('Пожалуйста, укажите ID раздела');
            return;
        }
        if (!categoryForm.icon || !categoryForm.icon.trim()) {
            alert('Пожалуйста, выберите иконку');
            return;
        }

        try {
            if (editingCategoryId === 'new') {
                await calculatorCategoryService.create({
                    id: categoryForm.id!,
                    name: categoryForm.name,
                    icon: categoryForm.icon,
                    color: categoryForm.color || '#3b82f6'
                });
            } else {
                await calculatorCategoryService.update(editingCategoryId!, categoryForm);
            }
            cancelEditCategory();
            await loadCategories();
        } catch (error) {
            console.error('Failed to save category:', error);
            alert('Ошибка при сохранении раздела: ' + (error as any).message);
        }
    };

    const deleteCategory = async (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить этот раздел? Все услуги из этого раздела должны быть удалены или перемещены.')) {
            try {
                await calculatorCategoryService.delete(id);
                if (activeTab === id && categories.length > 1) {
                    const nextCategory = categories.find(c => c.id !== id);
                    if (nextCategory) {
                        setActiveTab(nextCategory.id);
                    }
                }
                await loadCategories();
            } catch (error) {
                console.error('Failed to delete category:', error);
                alert('Ошибка при удалении раздела: ' + (error as any).message);
            }
        }
    };

    const renderCard = (srv: ServiceItem) => {
        const qty = selections[srv.id] || 0;
        const isActive = qty > 0;

        return (
            <div key={srv.id} className={`group relative flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300 ${isActive ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-100 translate-y-[-4px]' : 'bg-white border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-md'}`}>
                {isEditMode && (
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
                        <button onClick={() => startEditing(srv)} className={`p-2 rounded-full transition-colors ${isActive ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={(e) => deleteService(e, srv.id)} className={`p-2 rounded-full transition-colors ${isActive ? 'bg-rose-400 text-white hover:bg-rose-500' : 'bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-50'}`}>{srv.icon}</div>
                    <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{srv.name}</h4>
                        <p className={`text-xs font-bold font-mono mt-0.5 ${isActive ? 'text-blue-200' : 'text-blue-600'}`}>{srv.price.toLocaleString()} ₸</p>
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-dashed border-opacity-20 border-current">
                    {srv.type === 'range' ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className={`text-3xl font-black tracking-tighter ${isActive ? 'text-white' : 'text-slate-900'}`}>{qty}</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-200' : 'text-slate-400'}`}>Макс: {srv.max}</span>
                            </div>
                            <input type="range" min="0" max={srv.max} value={qty} onChange={e => updateSelection(srv.id, Number(e.target.value))} className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isActive ? 'accent-white bg-blue-500' : 'accent-blue-600 bg-slate-100'}`} />
                        </div>
                    ) : srv.type === 'counter' ? (
                        <div className="flex items-center justify-between">
                            <button onClick={() => updateSelection(srv.id, Math.max(0, qty - 1))} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${isActive ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>-</button>
                            <span className={`text-2xl font-black ${isActive ? 'text-white' : 'text-slate-900'}`}>{qty}</span>
                            <button onClick={() => updateSelection(srv.id, Math.min(srv.max || 99, qty + 1))} className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all ${isActive ? 'bg-white text-blue-600 hover:scale-110' : 'bg-blue-600 text-white hover:shadow-lg hover:shadow-blue-200'}`}>+</button>
                        </div>
                    ) : (
                        <button onClick={() => updateSelection(srv.id, isActive ? 0 : 1)} className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${isActive ? 'bg-white text-blue-600 shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600'}`}>
                            {isActive ? '✓ Выбрано' : '+ Добавить'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#fdfdfe] font-sans overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between shrink-0 z-30">
                <div className="flex items-center gap-6">
                    {onClose && (
                        <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Прайс-конструктор</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Smart Estimation v2.1</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={() => setIsEditMode(!isEditMode)} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditMode ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {isEditMode ? 'Завершить' : 'Настроить'}
                    </button>
                    <div className="h-8 w-px bg-slate-100"></div>
                    <div className="flex bg-slate-100 p-1.5 rounded-[1.25rem] max-w-2xl overflow-x-auto custom-scrollbar">
                        {categories.length === 0 && isLoading ? (
                            <div className="px-5 py-2 text-[10px] font-black text-slate-400">Загрузка...</div>
                        ) : categories.length === 0 && !isLoading ? (
                            <div className="px-5 py-2 text-[10px] font-black text-rose-500">
                                Нет разделов! Откройте консоль браузера (F12) для диагностики.
                            </div>
                        ) : (
                            <>
                                {categories.map(cat => (
                                    <div key={cat.id} className="relative group">
                                        <button
                                            onClick={() => setActiveTab(cat.id)}
                                            className={`px-5 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 ${activeTab === cat.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            <span>{cat.icon}</span>
                                            <span>{cat.name}</span>
                                        </button>
                                        {isEditMode && (
                                            <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startEditingCategory(cat);
                                                    }}
                                                    className="p-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-lg"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteCategory(cat.id);
                                                    }}
                                                    className="p-1 bg-rose-500 text-white rounded-lg hover:bg-rose-600 shadow-lg"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isEditMode && (
                                    <button
                                        onClick={() => startEditingCategory()}
                                        className="px-4 py-2 text-[10px] font-black uppercase rounded-xl text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                        <span>Раздел</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
                <div className="max-w-7xl mx-auto pb-32">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-sm font-bold text-slate-400">Загрузка услуг...</p>
                            </div>
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="text-center max-w-md">
                                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Нет разделов калькулятора</h3>
                                <p className="text-sm text-slate-500 mb-4">Откройте консоль браузера (F12) чтобы увидеть диагностическую информацию.</p>
                                <div className="bg-slate-50 p-4 rounded-lg text-left text-xs">
                                    <p className="font-mono text-slate-600">Categories: {categories.length}</p>
                                    <p className="font-mono text-slate-600">Services: {services.length}</p>
                                    <p className="font-mono text-slate-600">Loading: {isLoading ? 'true' : 'false'}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
                        {services.filter(s => s.category === activeTab).map(srv => renderCard(srv))}
                        {isEditMode && (
                            <button onClick={() => startEditing()} className="flex flex-col items-center justify-center p-8 rounded-[2.5rem] border-4 border-dashed border-slate-100 text-slate-300 hover:border-blue-200 hover:text-blue-400 hover:bg-blue-50/30 transition-all min-h-[260px] group">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg></div>
                                <span className="text-xs font-black uppercase tracking-widest">Добавить услугу</span>
                            </button>
                        )}
                    </div>
                    )}
                </div>
            </div>

            {editingId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white">
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingId === 'new' ? 'Новая услуга' : 'Редактирование'}</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">Категория: {activeTab.toUpperCase()}</p>
                            </div>
                            <button onClick={cancelEdit} className="p-2 text-slate-300 hover:text-slate-600 bg-white rounded-2xl shadow-sm border border-slate-100"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-3">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Иконка</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-3 py-4 text-center text-3xl focus:bg-white focus:border-blue-100 transition-all outline-none" value={editForm.icon} onChange={e => setEditForm({...editForm, icon: e.target.value})} />
                                </div>
                                <div className="col-span-9">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Название услуги</label>
                                    <input type="text" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 focus:bg-white focus:border-blue-100 transition-all outline-none" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Напр: Съемка Reels" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Цена (₸)</label>
                                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-blue-600 focus:bg-white focus:border-blue-100 transition-all outline-none font-mono" value={editForm.price || ''} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} onFocus={e => e.target.select()} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Тип ввода</label>
                                    <select className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-xs font-black text-slate-700 outline-none focus:bg-white focus:border-blue-100 appearance-none" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value as any})}>
                                        <option value="checkbox">Чекбокс (Вкл/Выкл)</option>
                                        <option value="counter">Счетчик (+/-)</option>
                                        <option value="range">Ползунок (0-X)</option>
                                    </select>
                                </div>
                            </div>

                            {(editForm.type === 'counter' || editForm.type === 'range') && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Максимальное значение</label>
                                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 focus:bg-white focus:border-blue-100 transition-all outline-none font-mono" value={editForm.max || ''} onChange={e => setEditForm({...editForm, max: Number(e.target.value)})} onFocus={e => e.target.select()} placeholder="10" />
                                    <p className="text-[9px] text-slate-400 mt-2 ml-1">Для типов "Счетчик" и "Ползунок"</p>
                                </div>
                            )}

                            <div className="pt-6 flex gap-4">
                                <button onClick={cancelEdit} className="flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors">Отмена</button>
                                <button onClick={saveEdit} className="flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] transition-all">Сохранить</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editingCategoryId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white">
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingCategoryId === 'new' ? 'Новый раздел' : 'Редактирование раздела'}</h3>
                                <p className="text-xs font-bold text-slate-400 mt-1">Управление категориями калькулятора</p>
                            </div>
                            <button onClick={cancelEditCategory} className="p-2 text-slate-300 hover:text-slate-600 bg-white rounded-2xl shadow-sm border border-slate-100">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-3">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Иконка</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-3 py-4 text-center text-3xl focus:bg-white focus:border-blue-100 transition-all outline-none"
                                        value={categoryForm.icon || ''}
                                        onChange={e => setCategoryForm({...categoryForm, icon: e.target.value})}
                                    />
                                </div>
                                <div className="col-span-9">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Название раздела</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 focus:bg-white focus:border-blue-100 transition-all outline-none"
                                        value={categoryForm.name || ''}
                                        onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                                        placeholder="Например: SMM"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">ID раздела</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 focus:bg-white focus:border-blue-100 transition-all outline-none font-mono"
                                        value={categoryForm.id || ''}
                                        onChange={e => setCategoryForm({...categoryForm, id: e.target.value})}
                                        placeholder="smm"
                                        disabled={editingCategoryId !== 'new'}
                                    />
                                    <p className="text-[9px] text-slate-400 mt-2 ml-1">Латиницей, без пробелов</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Цвет</label>
                                    <input
                                        type="color"
                                        className="w-full h-[56px] bg-slate-50 border-2 border-slate-50 rounded-2xl px-2 focus:bg-white focus:border-blue-100 transition-all outline-none cursor-pointer"
                                        value={categoryForm.color || '#3b82f6'}
                                        onChange={e => setCategoryForm({...categoryForm, color: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    onClick={cancelEditCategory}
                                    className="flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={saveCategory}
                                    className="flex-1 py-5 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] transition-all"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border-t border-slate-100 p-6 md:p-10 shrink-0 z-40 shadow-[0_-20px_50px_rgba(0,0,0,0.04)]">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-12">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Итоговая смета КП</p>
                            <div className="flex items-baseline gap-3">
                                <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">{totals.grand.toLocaleString()}</span>
                                <span className="text-2xl font-bold text-slate-300">₸</span>
                            </div>
                        </div>
                        <div className="hidden lg:flex gap-8 border-l border-slate-100 pl-10">
                            {categories.map(cat => (
                                <div key={cat.id}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest flex items-center gap-1">
                                        <span>{cat.icon}</span>
                                        <span>{cat.name}</span>
                                    </p>
                                    <p className="text-md font-black text-slate-700 font-mono">{(totals[cat.id] || 0).toLocaleString()} ₸</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <button onClick={handleApply} className="w-full sm:w-auto px-16 py-5 bg-slate-900 text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-[1.5rem] hover:bg-blue-600 transition-all shadow-2xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-4 group">
                        <span>Вставить в сделку</span>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ServiceCalculator;
