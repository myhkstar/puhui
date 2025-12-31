/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState } from 'react';
import { User, UserRole, AdminUsageLog } from '../types';
import { userService } from '../services/userService';
import { Trash2, Shield, User as UserIcon, RefreshCw, Calendar, Loader2, Edit2, X, Check, AlertTriangle, Plus, UserPlus, Clock, Mail, Phone, Lock, Activity, Coins } from 'lucide-react';

const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [usageLogs, setUsageLogs] = useState<AdminUsageLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit State
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<{
        displayName: string;
        role: UserRole;
        isApproved: boolean;
        expirationDateStr: string; // YYYY-MM-DD
        contactEmail: string;
        mobile: string;
        tokens: number;
    }>({
        displayName: '',
        role: 'user',
        isApproved: false,
        expirationDateStr: '',
        contactEmail: '',
        mobile: '',
        tokens: 0
    });

    // Create State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({ username: '', password: '', displayName: '', role: 'user' as UserRole });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'usage'>('users');

    const refreshData = async () => {
        setLoading(true);
        const [usersData, usageData] = await Promise.all([
            userService.getAllUsers(),
            userService.getAllUsage()
        ]);

        usersData.sort((a, b) => {
            if (a.isApproved === b.isApproved) {
                return b.created_at - a.created_at;
            }
            return a.isApproved ? 1 : -1;
        });
        setUsers(usersData);
        setUsageLogs(usageData);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const handleDelete = async (user: User) => {
        if (window.confirm(`確定要刪除用戶 "${user.username}" 嗎？\n\n注意：這將移除該用戶的個人資料並阻止其登入。`)) {
            if (user.uid) {
                await userService.deleteUser(user.uid);
                refreshData();
            }
        }
    };

    const formatDateInput = (timestamp: number | undefined): string => {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return d.toISOString().split('T')[0];
    };

    const startEdit = (user: User) => {
        setEditingUser(user);
        setEditForm({
            displayName: user.displayName || user.username,
            role: user.role,
            isApproved: user.isApproved,
            expirationDateStr: formatDateInput(user.expirationDate),
            contactEmail: user.contactEmail || '',
            mobile: user.mobile || '',
            tokens: user.tokens || 0
        });
    };

    const cancelEdit = () => {
        setEditingUser(null);
    };

    const handleRoleChange = (newRole: UserRole) => {
        // Auto set expiration date logic based on role change
        const now = new Date();
        let newDateStr = editForm.expirationDateStr;

        if (newRole === 'user') {
            now.setDate(now.getDate() + 7);
            newDateStr = now.toISOString().split('T')[0];
        } else if (newRole === 'vip' || newRole === 'thinker') {
            now.setMonth(now.getMonth() + 1);
            newDateStr = now.toISOString().split('T')[0];
        } else if (newRole === 'admin') {
            // 100 years
            newDateStr = '2100-01-01';
        }

        setEditForm({
            ...editForm,
            role: newRole,
            expirationDateStr: newDateStr
        });
    };

    const saveEdit = async () => {
        if (editingUser && editingUser.uid) {
            const updates: Partial<User> = {
                displayName: editForm.displayName,
                role: editForm.role,
                isApproved: editForm.isApproved,
                contactEmail: editForm.contactEmail,
                mobile: editForm.mobile,
                tokens: editForm.tokens
            };

            // Convert string date back to timestamp
            if (editForm.expirationDateStr) {
                updates.expirationDate = new Date(editForm.expirationDateStr).getTime();
            } else {
                updates.expirationDate = 0; // or null logic
            }

            await userService.updateUser(editingUser.uid, updates);
            setEditingUser(null);
            refreshData();
        }
    };

    const translateError = (msg: string) => {
        if (msg.includes('auth/email-already-in-use')) return '此帳號已被註冊';
        if (msg.includes('auth/weak-password')) return '密碼強度不足 (至少 6 位)';
        if (msg.includes('auth/invalid-email')) return 'Email 格式無效';
        if (msg.includes('auth/network-request-failed')) return '網路錯誤，請檢查連線或網域授權';
        return msg;
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateError(null);

        if (!createForm.username || !createForm.password) {
            setCreateError("請填寫帳號和密碼");
            setCreateLoading(false);
            return;
        }

        try {
            const result = await userService.createUserByAdmin(
                createForm.username,
                createForm.password,
                createForm.displayName || createForm.username,
                createForm.role
            );

            if (result.success) {
                setShowCreateModal(false);
                setCreateForm({ username: '', password: '', displayName: '', role: 'user' });
                refreshData();
            } else {
                setCreateError(translateError(result.message));
            }
        } catch (e: any) {
            setCreateError(translateError(e.message));
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto mt-8 animate-in fade-in duration-500 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Shield className="w-6 h-6 text-amber-500" />
                        系統管理員控制台
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">管理用戶帳戶、權限與監控使用情況</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> 新增用戶
                    </button>
                    <button
                        onClick={refreshData}
                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        disabled={loading}
                        title="重新整理"
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`pb-3 px-1 text-sm font-bold transition-colors relative ${activeTab === 'users' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`}
                >
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> 用戶列表
                    </div>
                    {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-600 dark:bg-cyan-400"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('usage')}
                    className={`pb-3 px-1 text-sm font-bold transition-colors relative ${activeTab === 'usage' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500'}`}
                >
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" /> 使用記錄
                    </div>
                    {activeTab === 'usage' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-600 dark:bg-cyan-400"></div>}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="p-12 flex justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'users' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">用戶</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">狀態/角色</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tokens</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">有效期</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {users.map((user) => (
                                            <tr key={user.uid || user.username} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!user.isApproved ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${!user.isApproved ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' :
                                                            user.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                                                                user.role === 'vip' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                                                                    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600'}`}>
                                                            <UserIcon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                                                {user.displayName || user.username}
                                                                {!user.isApproved && <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">待審核</span>}
                                                            </p>
                                                            <p className="text-xs text-slate-500 font-mono">@{user.username}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`w-fit text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${user.role === 'admin' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' :
                                                                user.role === 'vip' ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400' :
                                                                    user.role === 'thinker' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' :
                                                                        'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                                                            {user.role === 'admin' ? '管理員' : user.role === 'vip' ? 'VIP' : user.role === 'thinker' ? 'Thinker' : '普通用戶'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            註冊: {new Date(user.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 font-mono">
                                                        <Coins className="w-4 h-4 text-amber-500" />
                                                        <span>{user.tokens?.toLocaleString() || 0}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                                                        <Clock className="w-3 h-3" />
                                                        {user.role === 'admin' ? '永久' : (
                                                            user.expirationDate ? (
                                                                <span className={Date.now() > user.expirationDate ? 'text-red-500 font-bold' : ''}>
                                                                    {new Date(user.expirationDate).toLocaleDateString()}
                                                                    {Date.now() > user.expirationDate && ' (已過期)'}
                                                                </span>
                                                            ) : <span className="text-amber-500">未設定</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => startEdit(user)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${!user.isApproved ? 'bg-green-100 hover:bg-green-200 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-600 dark:bg-slate-800 dark:text-slate-400'}`}
                                                        >
                                                            {!user.isApproved ? <Check className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                                                            {!user.isApproved ? '審核' : '編輯'}
                                                        </button>
                                                        {user.role !== 'admin' && (
                                                            <button
                                                                onClick={() => handleDelete(user)}
                                                                className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-900/30 dark:text-slate-400 dark:hover:text-red-400 rounded-lg transition-all flex items-center gap-1"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> 刪除
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'usage' && (
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">日期/時間</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">用戶</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">功能</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tokens</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {usageLogs.length === 0 ? (
                                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">尚無使用記錄</td></tr>
                                        ) : (
                                            usageLogs.map((log, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                    <td className="px-6 py-3 text-sm text-slate-500 font-mono">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                        {log.username}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300">
                                                            {log.feature}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className="inline-flex items-center gap-1 font-mono text-sm text-slate-600 dark:text-slate-400">
                                                            <Coins className="w-3 h-3 text-amber-500" />
                                                            {log.tokenCount?.toLocaleString() || 0}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create User Modal (Reuse existing, just needs to handle new types if needed, but simplified for admin create) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                        <button onClick={() => setShowCreateModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>

                        <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-cyan-500" /> 新增用戶 (由管理員)
                        </h3>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">帳號 (Username)</label>
                                <input
                                    type="text"
                                    value={createForm.username}
                                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                    placeholder="輸入帳號"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">密碼 (Password)</label>
                                <input
                                    type="text"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                    placeholder="至少 6 碼"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">顯示名稱</label>
                                <input
                                    type="text"
                                    value={createForm.displayName}
                                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                    placeholder="例如：王小明"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">權限角色</label>
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                >
                                    <option value="user">普通用戶 (有效期 7 天)</option>
                                    <option value="vip">VIP (有效期 1 個月)</option>
                                    <option value="thinker">Thinker (有效期 1 個月)</option>
                                    <option value="admin">管理員</option>
                                </select>
                            </div>

                            {createError && (
                                <div className="text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" /> {createError}
                                </div>
                            )}

                            <div className="flex gap-3 mt-6 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">取消</button>
                                <button type="submit" disabled={createLoading} className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
                                    {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> 建立並核准</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit/Approve User Modal */}
            {editingUser && (
                <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                        <button onClick={cancelEdit} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>

                        <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                            <Edit2 className="w-5 h-5 text-cyan-500" /> 編輯/審核用戶
                        </h3>

                        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg flex items-center gap-3">
                                <UserIcon className="w-5 h-5 text-slate-400" />
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">帳號</p>
                                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300">@{editingUser.username}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">顯示名稱</label>
                                <input
                                    type="text"
                                    value={editForm.displayName}
                                    onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">電子信箱 (選填)</label>
                                <input
                                    type="email"
                                    value={editForm.contactEmail}
                                    onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                    placeholder="example@email.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">聯絡電話 (選填)</label>
                                <input
                                    type="tel"
                                    value={editForm.mobile}
                                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                    placeholder="0912-345-678"
                                />
                            </div>

                            <div className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl mt-4">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border ${editForm.isApproved ? 'bg-green-500 border-green-500 text-white' : 'border-slate-400 bg-white dark:bg-slate-800'}`}>
                                    {editForm.isApproved && <Check className="w-3.5 h-3.5" />}
                                </div>
                                <label className="flex-1 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={editForm.isApproved}
                                        onChange={(e) => setEditForm({ ...editForm, isApproved: e.target.checked })}
                                        className="hidden"
                                    />
                                    <span className="text-sm font-bold text-slate-900 dark:text-white block">審核通過 (允許登入)</span>
                                    <span className="text-xs text-slate-500 block">未通過審核的用戶無法登入系統</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">權限角色</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                >
                                    <option value="user">普通用戶 (User)</option>
                                    <option value="vip">VIP 會員</option>
                                    <option value="thinker">Thinker</option>
                                    <option value="admin">管理員 (Admin)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">帳號有效期 (YYYY-MM-DD)</label>
                                <input
                                    type="date"
                                    value={editForm.expirationDateStr}
                                    onChange={(e) => setEditForm({ ...editForm, expirationDateStr: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Token 餘額</label>
                                <input
                                    type="number"
                                    value={editForm.tokens}
                                    onChange={(e) => setEditForm({ ...editForm, tokens: parseInt(e.target.value, 10) || 0 })}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white"
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button onClick={cancelEdit} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">取消</button>
                                <button onClick={saveEdit} className="flex-1 py-2.5 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
                                    <Check className="w-4 h-4" /> 儲存變更
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;

