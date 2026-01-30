import React, { useState, useRef } from 'react';
import { User, Mail, Lock, Camera, Save, X, Shield, UserIcon, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';

interface UserProfileModalProps {
    user: UserType;
    onClose: () => void;
    onUpdate: (updatedUser: UserType) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ user, onClose, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'security'>('personal');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: user.name,
        jobTitle: user.jobTitle,
        iin: user.iin || '',
        email: user.email,
        avatar: user.avatar
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Пожалуйста, выберите изображение' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Размер файла не должен превышать 5 МБ' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        try {
            console.log('Загрузка аватара (UserProfileModal):', {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            });

            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}_${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            console.log('Путь загрузки:', filePath);

            const { error: uploadError } = await supabase.storage
                .from('user-avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error('Ошибка загрузки в storage:', uploadError);
                throw uploadError;
            }

            console.log('Файл загружен в storage');

            const { data: { publicUrl } } = supabase.storage
                .from('user-avatars')
                .getPublicUrl(filePath);

            console.log('Public URL получен:', publicUrl);

            setFormData(prev => ({ ...prev, avatar: publicUrl }));
            setMessage({ type: 'success', text: 'Фото загружено успешно!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            setMessage({ type: 'error', text: `Ошибка при загрузке фото: ${error.message || 'Неизвестная ошибка'}` });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePersonal = async () => {
        if (!formData.name || !formData.jobTitle) {
            setMessage({ type: 'error', text: 'ФИО и должность обязательны' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        setMessage(null);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    name: formData.name,
                    job_title: formData.jobTitle,
                    iin: formData.iin || null,
                    avatar: formData.avatar
                })
                .eq('id', user.id);

            if (error) throw error;

            onUpdate({
                ...user,
                name: formData.name,
                jobTitle: formData.jobTitle,
                iin: formData.iin || undefined,
                avatar: formData.avatar
            });

            setMessage({ type: 'success', text: 'Данные успешно обновлены!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error updating personal info:', error);
            setMessage({ type: 'error', text: 'Ошибка при обновлении данных' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveContact = async () => {
        if (!formData.email) {
            setMessage({ type: 'error', text: 'Email обязателен' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (formData.email === user.email) {
            setMessage({ type: 'error', text: 'Email не изменен' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setMessage({ type: 'error', text: 'Введите корректный email' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        setMessage(null);
        try {
            const { error } = await supabase
                .from('users')
                .update({ email: formData.email })
                .eq('id', user.id);

            if (error) throw error;

            onUpdate({ ...user, email: formData.email });
            setMessage({ type: 'success', text: 'Email успешно обновлен!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error updating email:', error);
            setMessage({ type: 'error', text: 'Этот email уже используется' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Заполните все поля' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Новые пароли не совпадают' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Пароль должен содержать минимум 6 символов' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        setMessage(null);
        try {
            const { data: userData, error: checkError } = await supabase
                .from('users')
                .select('password')
                .eq('id', user.id)
                .single();

            if (checkError) throw checkError;

            if (userData.password !== passwordData.currentPassword) {
                setMessage({ type: 'error', text: 'Неверный текущий пароль' });
                setIsLoading(false);
                setTimeout(() => setMessage(null), 3000);
                return;
            }

            const { error: updateError } = await supabase
                .from('users')
                .update({ password: passwordData.newPassword })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setMessage({ type: 'success', text: 'Пароль успешно изменен!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error changing password:', error);
            setMessage({ type: 'error', text: 'Ошибка при смене пароля' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const tabs = [
        { id: 'personal', label: 'Личные данные', icon: UserIcon, color: 'blue' },
        { id: 'contact', label: 'Контакты', icon: Mail, color: 'emerald' },
        { id: 'security', label: 'Безопасность', icon: Shield, color: 'amber' }
    ];

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                <div
                    className="flex flex-col h-full max-h-[95vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-6 sm:p-8 pb-5 sm:pb-6 border-b border-slate-200 flex-shrink-0 bg-gradient-to-r from-slate-50 to-blue-50">
                        <div className="flex items-center gap-4 sm:gap-5">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 flex items-center justify-center shadow-xl shadow-blue-500/40">
                                <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-1">Настройки профиля</h2>
                                <p className="text-sm sm:text-base text-slate-600 font-semibold">Управление личными данными и безопасностью</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-white/80 rounded-2xl transition-all text-slate-400 hover:text-slate-600 flex-shrink-0 hover:shadow-md"
                        >
                            <X className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-8 pt-6">
                        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 bg-slate-100 p-1.5 sm:p-2 rounded-2xl">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as any);
                                            setMessage(null);
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-sm sm:text-base rounded-xl transition-all ${
                                            isActive
                                                ? 'bg-white text-slate-800 shadow-lg'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                        }`}
                                    >
                                        <Icon className="w-5 h-5 sm:w-5 sm:h-5 flex-shrink-0" />
                                        <span className="truncate">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {message && (
                            <div
                                className={`mb-6 p-4 sm:p-5 rounded-2xl flex items-start gap-3 sm:gap-4 text-sm sm:text-base font-semibold animate-in slide-in-from-top-2 duration-300 ${
                                    message.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border-2 border-rose-200'
                                }`}
                            >
                                {message.type === 'success' ? (
                                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                                )}
                                <span>{message.text}</span>
                            </div>
                        )}

                        <div className="space-y-8 max-w-3xl mx-auto">
                    {activeTab === 'personal' && (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="flex flex-col items-center py-8 sm:py-10 bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border-2 border-slate-200">
                                <div className="relative group">
                                    <img
                                        src={formData.avatar}
                                        alt={formData.name}
                                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-white shadow-2xl"
                                    />
                                    <button
                                        onClick={handleAvatarClick}
                                        disabled={isLoading}
                                        className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 active:opacity-100 transition-all disabled:opacity-50 backdrop-blur-sm"
                                    >
                                        <div className="flex flex-col items-center gap-2">
                                            <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                            <span className="text-xs sm:text-sm text-white font-bold">Изменить</span>
                                        </div>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        className="hidden"
                                    />
                                    <div className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl border-4 border-white">
                                        <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                    </div>
                                </div>
                                <p className="mt-4 sm:mt-5 text-xs sm:text-sm text-slate-600 font-semibold text-center px-4">
                                    Нажмите на фото для изменения (до 5 МБ)
                                </p>
                            </div>

                            <div className="space-y-5 sm:space-y-6">
                                <div>
                                    <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                        ФИО *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3.5 sm:px-5 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="Иванов Иван Иванович"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                        Должность *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.jobTitle}
                                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                        className="w-full px-4 py-3.5 sm:px-5 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="Менеджер проектов"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                        ИИН
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.iin}
                                        onChange={(e) => setFormData({ ...formData, iin: e.target.value })}
                                        className="w-full px-4 py-3.5 sm:px-5 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="000000000000"
                                        maxLength={12}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSavePersonal}
                                disabled={isLoading || !formData.name || !formData.jobTitle}
                                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black py-4 sm:py-5 px-6 sm:px-8 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 transition-all hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 text-base sm:text-lg"
                            >
                                <Save className="w-5 h-5 sm:w-6 sm:h-6" />
                                {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'contact' && (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="bg-gradient-to-br from-blue-50 to-emerald-50 border-2 border-blue-200 rounded-2xl p-5 sm:p-6">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                                        <Mail className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm sm:text-base font-black text-blue-900 mb-1">Email для входа</p>
                                        <p className="text-xs sm:text-sm text-blue-700 font-medium">
                                            Этот email используется для авторизации в системе
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                                    Email адрес *
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3.5 sm:px-5 sm:py-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <button
                                onClick={handleSaveContact}
                                disabled={isLoading || !formData.email}
                                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-black py-4 sm:py-5 px-6 sm:px-8 rounded-xl hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/30 transition-all hover:shadow-xl hover:shadow-emerald-600/40 hover:-translate-y-0.5 text-base sm:text-lg"
                            >
                                <Save className="w-5 h-5 sm:w-6 sm:h-6" />
                                {isLoading ? 'Сохранение...' : 'Обновить email'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6 sm:space-y-8">
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                                        <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm sm:text-base font-black text-amber-900 mb-1">Безопасность аккаунта</p>
                                        <p className="text-xs sm:text-sm text-amber-700 font-medium">
                                            Используйте надежный пароль длиной не менее 6 символов
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                                    Текущий пароль *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? "text" : "password"}
                                        value={passwordData.currentPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                        className="w-full px-4 py-3.5 pr-12 sm:px-5 sm:py-4 sm:pr-14 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="Введите текущий пароль"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    >
                                        {showCurrentPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                                    Новый пароль *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="w-full px-4 py-3.5 pr-12 sm:px-5 sm:py-4 sm:pr-14 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="Минимум 6 символов"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    >
                                        {showNewPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm sm:text-base font-black text-slate-700 mb-3 flex items-center gap-2">
                                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                                    Подтвердите пароль *
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="w-full px-4 py-3.5 pr-12 sm:px-5 sm:py-4 sm:pr-14 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none font-semibold text-base sm:text-lg text-slate-700 transition-all hover:border-slate-300"
                                        placeholder="Повторите новый пароль"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleChangePassword}
                                disabled={isLoading}
                                className="w-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black py-4 sm:py-5 px-6 sm:px-8 rounded-xl hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-amber-600/30 transition-all hover:shadow-xl hover:shadow-amber-600/40 hover:-translate-y-0.5 text-base sm:text-lg"
                            >
                                <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
                                {isLoading ? 'Изменение...' : 'Изменить пароль'}
                            </button>
                        </div>
                    )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
