import React, { useState, useRef } from 'react';
import { User, Mail, Lock, Camera, Save, Shield, UserIcon, CheckCircle, AlertCircle, Eye, EyeOff, CreditCard, Gift, Bell } from 'lucide-react';
import { User as UserType, SystemRole } from '../types';
import { supabase } from '../lib/supabase';
import BillingSection from './BillingSection';
import { AffiliateProgram } from './affiliate/AffiliateProgram';
import { NotificationsTab } from './NotificationsTab';
import UserAvatar from './UserAvatar';

interface ProfileSettingsPageProps {
    user: UserType;
    onUpdate: (updatedUser: UserType) => void;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ user, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<'personal' | 'contact' | 'notifications' | 'security' | 'billing' | 'affiliate'>('personal');
    const isAdmin = user.systemRole === SystemRole.ADMIN;
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
            console.log('Загрузка аватара:', {
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

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    avatar: publicUrl
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Ошибка обновления в БД:', updateError);
                throw updateError;
            }

            console.log('Аватар обновлен в БД');

            setFormData(prev => ({ ...prev, avatar: publicUrl }));
            onUpdate({ ...user, avatar: publicUrl });

            setMessage({ type: 'success', text: 'Фото профиля обновлено!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            setMessage({ type: 'error', text: `Ошибка при загрузке фото: ${error.message || 'Неизвестная ошибка'}` });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    name: formData.name,
                    job_title: formData.jobTitle,
                    iin: formData.iin,
                    email: formData.email,
                    avatar: formData.avatar
                })
                .eq('id', user.id);

            if (error) throw error;

            onUpdate({
                ...user,
                name: formData.name,
                jobTitle: formData.jobTitle,
                iin: formData.iin,
                email: formData.email,
                avatar: formData.avatar
            });

            setMessage({ type: 'success', text: 'Профиль обновлен успешно!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error updating profile:', error);
            setMessage({ type: 'error', text: 'Ошибка при обновлении профиля' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Пароли не совпадают' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Пароль должен быть не менее 6 символов' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        if (!passwordData.currentPassword) {
            setMessage({ type: 'error', text: 'Введите текущий пароль' });
            setTimeout(() => setMessage(null), 3000);
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    password: passwordData.newPassword
                })
                .eq('id', user.id)
                .eq('password', passwordData.currentPassword);

            if (error) throw error;

            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            setMessage({ type: 'success', text: 'Пароль изменен успешно!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error changing password:', error);
            setMessage({ type: 'error', text: 'Ошибка при смене пароля. Проверьте текущий пароль.' });
            setTimeout(() => setMessage(null), 3000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Настройки профиля</h1>
                <p className="text-sm text-slate-500 mt-1">Управление личными данными и безопасность</p>
            </div>

            {message && (
                <div className={`mx-4 sm:mx-6 lg:mx-8 mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm sm:text-base">{message.text}</span>
                </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                <div className="lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-x-auto lg:overflow-x-visible">
                    <nav className="flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 p-4 lg:p-6 min-w-max lg:min-w-0">
                        <button
                            onClick={() => setActiveTab('personal')}
                            className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                activeTab === 'personal'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <UserIcon className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm lg:text-base">Личные данные</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('contact')}
                            className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                activeTab === 'contact'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Mail className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm lg:text-base">Контактная информация</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                activeTab === 'notifications'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Bell className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm lg:text-base">Уведомления</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                activeTab === 'security'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Shield className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm lg:text-base">Безопасность</span>
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('billing')}
                                className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                    activeTab === 'billing'
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <CreditCard className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm lg:text-base">Тарифы и платежи</span>
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('affiliate')}
                            className={`flex-shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-left transition-colors whitespace-nowrap ${
                                activeTab === 'affiliate'
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <Gift className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm lg:text-base">Партнерская программа</span>
                        </button>
                    </nav>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="max-w-3xl mx-auto">
                        {activeTab === 'personal' && (
                            <div className="space-y-4 sm:space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">Фотография профиля</h2>
                                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                                                <UserAvatar src={formData.avatar} name={formData.name} size="xl" className="!w-full !h-full !text-2xl" />
                                            </div>
                                            <button
                                                onClick={handleAvatarClick}
                                                disabled={isLoading}
                                                className="absolute bottom-0 right-0 p-1.5 sm:p-2 bg-blue-600 rounded-full text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                                            >
                                                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            </button>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarUpload}
                                                className="hidden"
                                            />
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <h3 className="font-medium text-slate-800 text-sm sm:text-base">{formData.name}</h3>
                                            <p className="text-xs sm:text-sm text-slate-500">{formData.jobTitle}</p>
                                            <p className="text-xs text-slate-400 mt-1 sm:mt-2">JPG, PNG до 5 МБ</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">Основная информация</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Полное имя
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Введите ваше имя"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Должность
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.jobTitle}
                                                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Ваша должность"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                ИИН
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.iin}
                                                onChange={(e) => setFormData({ ...formData, iin: e.target.value })}
                                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Индивидуальный идентификационный номер"
                                                maxLength={12}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'contact' && (
                            <div className="space-y-4 sm:space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">Email</h2>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Электронная почта
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-5 h-5" />
                                    {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <NotificationsTab
                                userId={user.id}
                                userEmail={user.email}
                                organizationId={(() => {
                                    try {
                                        const stored = localStorage.getItem('currentUser');
                                        return stored ? JSON.parse(stored).organizationId : '';
                                    } catch { return ''; }
                                })()}
                            />
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-4 sm:space-y-6">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
                                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 mb-4">Изменить пароль</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Текущий пароль
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showCurrentPassword ? 'text' : 'password'}
                                                    value={passwordData.currentPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                    placeholder="Введите текущий пароль"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Новый пароль
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? 'text' : 'password'}
                                                    value={passwordData.newPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                    placeholder="Минимум 6 символов"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Подтвердите новый пароль
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={passwordData.confirmPassword}
                                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                                                    placeholder="Повторите новый пароль"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleChangePassword}
                                    disabled={isLoading}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Lock className="w-5 h-5" />
                                    {isLoading ? 'Изменение...' : 'Изменить пароль'}
                                </button>
                            </div>
                        )}

                        {activeTab === 'billing' && isAdmin && (
                            <BillingSection userId={user.id} />
                        )}

                        {activeTab === 'affiliate' && (
                            <AffiliateProgram
                                organizationId={(() => {
                                    try {
                                        const stored = localStorage.getItem('currentUser');
                                        return stored ? JSON.parse(stored).organizationId : '';
                                    } catch { return ''; }
                                })()}
                                userId={user.id}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettingsPage;
