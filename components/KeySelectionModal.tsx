import React from 'react';
import { CreditCard, DollarSign, ExternalLink, Key } from 'lucide-react';

interface KeySelectionModalProps {
    onSelectKey: () => Promise<void>;
}

const KeySelectionModal: React.FC<KeySelectionModalProps> = ({ onSelectKey }) => (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>

            <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                    <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-2 border-4 border-white dark:border-slate-900 shadow-lg">
                        <CreditCard className="w-8 h-8" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border-2 border-white dark:border-slate-900 uppercase tracking-wide">
                        付費應用
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                        需要付費 API 金鑰
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-medium">
                        本應用程式使用 Gemini 3 Pro 進階模型，無法在免費層級上使用。
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                        您必須選擇一個<span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1 py-0.5 rounded">已啟用計費</span>的 Google Cloud 專案才能繼續。
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 w-full text-left">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-200">需要計費</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                標準 API 金鑰將無法使用。請確認您已在 Google AI Studio 設定計費。
                            </p>
                            <a
                                href="https://ai.google.dev/gemini-api/docs/billing"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline mt-1"
                            >
                                查看計費文檔 <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onSelectKey}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                    <Key className="w-4 h-4" />
                    <span>選擇付費 API 金鑰</span>
                </button>
            </div>
        </div>
    </div>
);

export default KeySelectionModal;
