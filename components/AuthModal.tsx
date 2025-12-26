/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { userService } from '../services/userService';
import { X, User as UserIcon, Lock, LogIn, UserPlus, AlertCircle, Loader2, Mail, Phone, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoginSuccess: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [mobile, setMobile] = useState('');
    
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');

    // Reset state when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setLoadingText('');
            setError(null);
            setSuccessMessage(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setDisplayName('');
        setContactEmail('');
        setMobile('');
        setError(null);
        setSuccessMessage(null);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        setLoadingText('正在建立安全連線...');

        try {
            if (isLoginView) {
                // Change text slightly after a moment if it takes time
                const timer = setTimeout(() => setLoadingText('正在驗證憑證...'), 2000);
                
                const user = await userService.login(username, password);
                clearTimeout(timer);
                
                if (user) {
                    onLoginSuccess(user);
                    onClose();
                    resetForm();
                }
            } else {
                if (!username || !password) {
                    setError('請填寫必填欄位');
                    setLoading(false);
                    return;
                }
                
                setLoadingText('正在建立您的帳戶...');
                // Register
                const result = await userService.register(username, password, displayName, contactEmail, mobile);
                
                if (result.success) {
                    setSuccessMessage("您的註冊已成功，目前正等待管理員通過。請耐心等候。");
                } else {
                    setError(result.message);
                }
            }
        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || '';
            
            if (errorMessage.includes('ETIMEDOUT')) {
                setError('無法連接至資料庫 (連線逾時)。這可能是因為您的網路環境封鎖了對外資料庫連線 (Port 3306)。');
            } else if (errorMessage.includes('ECONNREFUSED')) {
                setError('無法連接至資料庫 (連線被拒)。請檢查資料庫伺服器是否正在運行。');
            } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || errorMessage.includes('Invalid password') || errorMessage.includes('User not found')) {
                setError('帳號或密碼錯誤');
            } else if (err.code === 'auth/email-already-in-use' || errorMessage.includes('exists')) {
                 setError('此帳號已被註冊');
            } else if (err.code === 'auth/network-request-failed') {
                setError('網路連線失敗。如果您在預覽環境，請確認網域已加入白名單。');
            } else {
                setError(errorMessage || '發生錯誤，請稍後再試');
            }
        } finally {
            setLoading(false);
            setLoadingText('');
        }
    };

    const toggleView = () => {
        setIsLoginView(!isLoginView);
        resetForm();
    };

    const handleClose = () => {
        if (loading) return; // Prevent closing while submitting
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative">
                <button 
                    onClick={handleClose}
                    type="button"
                    disabled={loading}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-50 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    {successMessage ? (
                        <div className="text-center py-8 animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 dark:text-green-400">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">註冊申請已送出</h3>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
                                {successMessage}
                            </p>
                            <button 
                                onClick={handleClose}
                                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-colors"
                            >
                                關閉
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-600 dark:text-cyan-400">
                                    {isLoginView ? <LogIn className="w-8 h-8" /> : <UserPlus className="w-8 h-8" />}
                                </div>
                                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                                    {isLoginView ? '歡迎回來' : '建立帳戶'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                                    {isLoginView ? '請輸入您的帳號密碼以繼續' : '註冊後需等待管理員審核'}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        帳號 (Username) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text" 
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white disabled:opacity-50"
                                            placeholder="輸入帳號"
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                </div>

                                {!isLoginView && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                顯示名稱 (Display Name)
                                            </label>
                                            <div className="relative">
                                                <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white disabled:opacity-50"
                                                    placeholder="例如：張三"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                電子信箱 (選填)
                                            </label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="email" 
                                                    value={contactEmail}
                                                    onChange={(e) => setContactEmail(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white disabled:opacity-50"
                                                    placeholder="example@mail.com"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                手機號碼 (選填)
                                            </label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="tel" 
                                                    value={mobile}
                                                    onChange={(e) => setMobile(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white disabled:opacity-50"
                                                    placeholder="0912-345-678"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        密碼 <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="password" 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white disabled:opacity-50"
                                            placeholder="輸入密碼"
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        <span className="break-words">{error}</span>
                                    </div>
                                )}

                                <button 
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>{loadingText}</span>
                                        </>
                                    ) : (
                                        isLoginView ? '登入' : '註冊'
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <button 
                                    onClick={toggleView}
                                    className="text-sm text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 font-medium transition-colors"
                                    disabled={loading}
                                >
                                    {isLoginView ? '還沒有帳號？立即註冊' : '已有帳號？返回登入'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;