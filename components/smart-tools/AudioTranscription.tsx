import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../../services/userService';
import { FileAudio, Upload, Download, Trash2, History, CheckCircle, AlertCircle, Loader2, X, FileText, Wand2, BookText } from 'lucide-react';

type ProcessingStage = 'idle' | 'uploading' | 'transcribing' | 'refining' | 'done';

interface Transcript {
    id: string;
    title: string;
    keywords?: string;
    content?: string;
    rawContent?: string;
    createdAt: number;
}

const AudioTranscription: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
    const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(null);
    const [history, setHistory] = useState<Transcript[]>([]);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await userService.getTranscriptHistory();
            setHistory(data);
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            if (files.length + selectedFiles.length > 5) {
                setError("最多只能上傳 5 個檔案");
                return;
            }
            setFiles(prev => [...prev, ...selectedFiles]);
            setError(null);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleProcess = async () => {
        if (files.length === 0) return;

        setProcessingStage('transcribing');
        setError(null);
        setActiveTranscript(null);

        try {
            const data = await userService.processTranscript(files);
            setActiveTranscript({
                id: data.id,
                title: data.title,
                rawContent: data.rawContent,
                createdAt: data.createdAt,
            });
            setFiles([]);
            setProcessingStage('done');
            loadHistory();
        } catch (err: any) {
            setError(err.message || "初步轉寫失敗，請稍後再試");
            setProcessingStage('idle');
        }
    };

    const handleRefine = async (type: 'organize' | 'formalize') => {
        if (!activeTranscript) return;

        setProcessingStage('refining');
        setError(null);
        try {
            const refinedData = await userService.refineTranscript(activeTranscript.id, type);
            setActiveTranscript(prev => prev ? { ...prev, ...refinedData } : null);
        } catch (err: any) {
            setError(err.message || "AI 處理失敗，請稍後再試");
        } finally {
            setProcessingStage('done');
        }
    };
    
    const handleDownload = (transcript: Transcript) => {
        const textToDownload = transcript.content 
            ? `${transcript.keywords}\n\n${transcript.content}`
            : transcript.rawContent || '';
        const blob = new Blob([textToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${transcript.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("確定要刪除這條記錄嗎？")) return;
        try {
            await userService.deleteTranscript(id);
            setHistory(prev => prev.filter(t => t.id !== id));
            if (activeTranscript?.id === id) setActiveTranscript(null);
        } catch (err) {
            setError("刪除失敗");
        }
    };

    const handleReset = () => {
        setFiles([]);
        setActiveTranscript(null);
        setError(null);
        setProcessingStage('idle');
    };

    const isProcessing = processingStage === 'transcribing' || processingStage === 'refining';

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileAudio className="w-6 h-6 text-cyan-500" />
                    錄音整理 (Recording Organizer)
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    上傳 1-5 個錄音檔案，AI 將為您轉寫初稿，並可按需進行整理或書面化。
                </p>
            </div>

            {/* Upload Section */}
            {!activeTranscript && (
                 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 mb-8 shadow-sm">
                    <div
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center transition-colors group ${isProcessing ? 'cursor-not-allowed' : 'cursor-pointer hover:border-cyan-500/50'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            accept="audio/*"
                            className="hidden"
                            disabled={isProcessing}
                        />
                        <div className="bg-cyan-50 dark:bg-cyan-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium mb-1">點擊或拖拽音訊檔案至此</p>
                        <p className="text-slate-400 text-xs">支援 MP3, WAV, M4A 等格式 (最多 5 個檔案)</p>
                    </div>

                    {files.length > 0 && (
                        <div className="mt-6 space-y-3">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <FileAudio className="w-5 h-5 text-slate-400" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{file.name}</p>
                                            <p className="text-[10px] text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <button onClick={() => removeFile(index)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={handleProcess}
                                disabled={isProcessing}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                            >
                                {processingStage === 'transcribing' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        AI 正在轉寫初稿...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        開始整理
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Result Section */}
            {activeTranscript && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-cyan-200 dark:border-cyan-900/30 p-8 mb-8 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-1 block">
                                {activeTranscript.content ? '整理結果' : '轉寫初稿'}
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeTranscript.title}</h2>
                        </div>
                        {(activeTranscript.content || activeTranscript.rawContent) && (
                             <button
                                onClick={() => handleDownload(activeTranscript)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                下載文稿
                            </button>
                        )}
                    </div>

                    <div className="mb-6">
                        {activeTranscript.keywords && (
                            <p className="text-cyan-600 dark:text-cyan-400 font-bold tracking-wide mb-4">
                                {activeTranscript.keywords}
                            </p>
                        )}
                        {(activeTranscript.keywords || activeTranscript.content) && <div className="h-px bg-slate-100 dark:bg-slate-800 mb-6"></div>}
                        
                        <div className="prose dark:prose-invert max-w-none">
                            {(activeTranscript.content || activeTranscript.rawContent || '').split('\n').map((para, i) => (
                                <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {processingStage === 'refining' && (
                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mx-auto" />
                            <p className="mt-2 text-sm text-slate-500">AI 正在深度處理中...</p>
                        </div>
                    )}

                    {processingStage === 'done' && !activeTranscript.content && (
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
                            <button onClick={() => handleRefine('organize')} className="flex-1 flex flex-col items-center justify-center p-4 bg-cyan-50 dark:bg-cyan-900/30 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-lg transition-colors text-cyan-800 dark:text-cyan-200">
                                <Wand2 className="w-6 h-6 mb-2" />
                                <span className="font-bold">AI 整理</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">盡量忠實原文，保留口語</span>
                            </button>
                            <button onClick={() => handleRefine('formalize')} className="flex-1 flex flex-col items-center justify-center p-4 bg-cyan-50 dark:bg-cyan-900/30 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 rounded-lg transition-colors text-cyan-800 dark:text-cyan-200">
                                <BookText className="w-6 h-6 mb-2" />
                                <span className="font-bold">AI 書面化</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">保留原意的基礎上盡量書面化</span>
                            </button>
                        </div>
                    )}
                     {processingStage === 'done' && activeTranscript.content && (
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
                             <button onClick={handleReset} className="py-2 px-6 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold transition-colors">
                                處理新錄音
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* History Section */}
            {history.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <History className="w-4 h-4" />
                        歷史整理記錄
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl hover:border-cyan-500/30 transition-all group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate max-w-[180px]">{item.title}</h4>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setActiveTranscript(item)} className="p-1.5 text-slate-400 hover:text-cyan-500" title="查看">
                                            <FileText className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDownload(item)} className="p-1.5 text-slate-400 hover:text-cyan-500" title="下載">
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-500" title="刪除">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold mb-2 truncate">{item.keywords || '尚未整理'}</p>
                                <p className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudioTranscription;
