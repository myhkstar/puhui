import React, { useState, useEffect, useContext } from 'react';
import { userService } from '../services/userService';
import { SpecialAssistant, User } from '../types';
import { Plus, Edit2, Trash2, Check, X, Sparkles, Bot } from 'lucide-react';

interface SpecialAssistantManagerProps {
    currentUser: User | null;
    onClose: () => void;
    onAssistantSelected: (assistant: SpecialAssistant | null) => void;
}

const SpecialAssistantManager: React.FC<SpecialAssistantManagerProps> = ({ currentUser, onClose, onAssistantSelected }) => {
    const [assistants, setAssistants] = useState<SpecialAssistant[]>([]);
    const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
    const [formState, setFormState] = useState<Partial<SpecialAssistant>>({});
    const [isEditingNew, setIsEditingNew] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            fetchAssistants();
        }
    }, [currentUser]);

    const fetchAssistants = async () => {
        setIsLoading(true);
        try {
            const fetchedAssistants = await userService.getSpecialAssistants();
            setAssistants(fetchedAssistants);
            if (fetchedAssistants.length > 0 && !selectedAssistantId) {
                setSelectedAssistantId(fetchedAssistants[0].id);
                setFormState(fetchedAssistants[0]);
            } else if (selectedAssistantId) {
                const currentSelected = fetchedAssistants.find(a => a.id === selectedAssistantId);
                if (currentSelected) {
                    setFormState(currentSelected);
                } else {
                    // If selected assistant was deleted, default to first or new
                    setSelectedAssistantId(fetchedAssistants[0]?.id || null);
                    setFormState(fetchedAssistants[0] || {});
                }
            } else {
                setFormState({});
                setIsEditingNew(true);
            }
        } catch (error) {
            console.error("Failed to fetch special assistants:", error);
            alert("獲取特別助手列表失敗。");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectAssistant = (assistant: SpecialAssistant) => {
        setSelectedAssistantId(assistant.id);
        setFormState(assistant);
        setIsEditingNew(false);
    };

    const handleCreateNewAssistant = () => {
        setSelectedAssistantId(null);
        setFormState({});
        setIsEditingNew(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!formState.name || !formState.role) {
            alert("特別助手名稱和角色為必填項。");
            return;
        }

        setIsLoading(true);
        try {
            const isVipOrThinker = currentUser?.role === 'vip' || currentUser?.role === 'thinker';
            const assistantCount = assistants.length;

            if (isEditingNew) {
                if (isVipOrThinker && assistantCount >= 10) {
                    alert("VIP 和 Thinker 用戶最多只能設置 10 個特別助手。");
                    return;
                }
                const newAssistant = await userService.createSpecialAssistant(formState as Omit<SpecialAssistant, 'id' | 'userId'>);
                setAssistants(prev => [...prev, newAssistant]);
                setSelectedAssistantId(newAssistant.id);
                setFormState(newAssistant);
                setIsEditingNew(false);
                alert("特別助手創建成功！");
            } else if (selectedAssistantId) {
                const updatedAssistant = await userService.updateSpecialAssistant(selectedAssistantId, formState);
                setAssistants(prev => prev.map(a => a.id === selectedAssistantId ? updatedAssistant : a));
                setFormState(updatedAssistant);
                alert("特別助手更新成功！");
            }
        } catch (error: any) {
            console.error("Failed to save special assistant:", error);
            alert(`保存特別助手失敗: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("確定要刪除此特別助手嗎？")) return;

        setIsLoading(true);
        try {
            await userService.deleteSpecialAssistant(id);
            setAssistants(prev => prev.filter(a => a.id !== id));
            if (selectedAssistantId === id) {
                setSelectedAssistantId(null);
                setFormState({});
                setIsEditingNew(true);
            }
            alert("特別助手刪除成功！");
        } catch (error: any) {
            console.error("Failed to delete special assistant:", error);
            alert(`刪除特別助手失敗: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseAssistant = () => {
        if (selectedAssistantId) {
            const assistant = assistants.find(a => a.id === selectedAssistantId);
            onAssistantSelected(assistant || null);
            onClose();
        } else {
            alert("請先選擇一個特別助手");
        }
    };

    const renderAssistantForm = () => (
        <div className="flex-1 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-md overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
                {isEditingNew ? "打造新助手" : "編輯特別助手"}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                您可以通過定義AI的角色、個性、語氣、專業領域與行事準則，來打造自己的特別助手。
            </p>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">特別助手名稱：<span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        name="name"
                        value={formState.name || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：天氣預報"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">角色：<span className="text-red-500">*</span></label>
                    <textarea
                        name="role"
                        value={formState.role || ''}
                        onChange={handleChange}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：你是一個天氣預報員"
                    ></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">個性：</label>
                    <input
                        type="text"
                        name="personality"
                        value={formState.personality || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：活潑可愛"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">語氣：</label>
                    <input
                        type="text"
                        name="tone"
                        value={formState.tone || ''}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：輕鬆自然"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">任務：(選填，比如，回答用戶關於天氣的問題)</label>
                    <textarea
                        name="task"
                        value={formState.task || ''}
                        onChange={handleChange}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：回答用戶關於天氣的問題"
                    ></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">步驟：(選填，比如，當用戶詢問你某地方的天氣時，你會查詢該地方的天氣資料，並回應該地區的氣溫與降雨機率)</label>
                    <textarea
                        name="steps"
                        value={formState.steps || ''}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：當用戶詢問你某地方的天氣時，你會查詢該地方的天氣資料，並回應該地區的氣溫與降雨機率"
                    ></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">格式：(選填，比如，[某地區]今日天氣為[天氣狀況]，氣溫[溫度]，降雨機率[%數字])</label>
                    <textarea
                        name="format"
                        value={formState.format || ''}
                        onChange={handleChange}
                        rows={2}
                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        placeholder="例如：[某地區]今日天氣為[天氣狀況]，氣溫[溫度]，降雨機率[%數字]"
                    ></textarea>
                </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors"
                >
                    取消
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    {isLoading ? '保存中...' : '保存'}
                </button>
                {!isEditingNew && selectedAssistantId && (
                    <button
                        onClick={() => handleDelete(selectedAssistantId)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        刪除
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-100 dark:bg-slate-950 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-purple-600" /> 特別助手管理
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Assistant List */}
                    <div className="w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col">
                        <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-200">我的特別助手</h3>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {isLoading && assistants.length === 0 ? (
                                <p className="text-slate-500">加載中...</p>
                            ) : assistants.length === 0 && !isEditingNew ? (
                                <div className="text-center text-slate-500 py-4">
                                    <Bot className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                                    <p>還沒有特別助手，快來打造一個吧！</p>
                                </div>
                            ) : (
                                assistants.map(assistant => (
                                    <div
                                        key={assistant.id}
                                        onClick={() => handleSelectAssistant(assistant)}
                                        className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${selectedAssistantId === assistant.id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <span className="text-sm font-medium truncate">{assistant.name}</span>
                                        {selectedAssistantId === assistant.id && <Check className="w-4 h-4 text-purple-600" />}
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={handleCreateNewAssistant}
                            className="w-full py-2 mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            disabled={isLoading}
                        >
                            <Plus className="w-4 h-4" /> 打造新助手
                        </button>
                    </div>

                    {/* Right Panel: Assistant Form */}
                    {renderAssistantForm()}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <button
                        onClick={handleUseAssistant}
                        disabled={isLoading || !selectedAssistantId}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        使用此助手來聊天
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SpecialAssistantManager;