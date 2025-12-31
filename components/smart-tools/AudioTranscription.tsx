import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../../services/userService';
import { FileAudio, Upload, Download, Trash2, History, CheckCircle, AlertCircle, Loader2, X, FileText } from 'lucide-react';

interface Transcript {
    id: string;
    title: string;
    keywords: string;
    content: string;
    createdAt: number;
}

const AudioTranscription: React.FC = () => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<Transcript | null>(null);
    const [history, setHistory] = useState<Transcript[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
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

        setIsProcessing(true);
        setError(null);
        setUploadProgress(10); // Initial progress

        try {
            const data = await userService.processTranscript(files);
            setResult(data);
            setFiles([]);
            loadHistory();
        } catch (err: any) {
            setError(err.message || "處理失敗，請稍後再試");
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = (transcript: Transcript) => {
        const text = `${transcript.keywords}\n\n${transcript.content}`;
        const blob = new Blob([text], { type: 'text/plain' });
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
            if (result?.id === id) setResult(null);
        } catch (err) {
            setError("刪除失敗");
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileAudio className="w-6 h-6 text-cyan-500" />
                    錄音整理 (Recording Organizer)
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    上傳 1-5 個錄音檔案（每個不超過 60 分鐘），AI 將為您提取文字並整理成通順的文稿。
                </p>
            </div>

            {/* Upload Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 mb-8 shadow-sm">
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center cursor-pointer hover:border-cyan-500/50 transition-colors group"
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        multiple
                        accept="audio/*"
                        className="hidden"
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
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    AI 正在整理中...
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

                {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}
            </div>

            {/* Result Section */}
            {result && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-cyan-200 dark:border-cyan-900/30 p-8 mb-8 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-1 block">整理結果</span>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{result.title}</h2>
                        </div>
                        <button
                            onClick={() => handleDownload(result)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            下載文稿
                        </button>
                    </div>

                    <div className="mb-6">
                        <p className="text-cyan-600 dark:text-cyan-400 font-bold tracking-wide mb-4">
                            {result.keywords}
                        </p>
                        <div className="h-px bg-slate-100 dark:bg-slate-800 mb-6"></div>
                        <div className="prose dark:prose-invert max-w-none">
                            {result.content.split('\n').map((para, i) => (
                                <p key={i} className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                                    {para}
                                </p>
                            ))}
                        </div>
                    </div>
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
                                        <button onClick={() => setResult(item)} className="p-1.5 text-slate-400 hover:text-cyan-500" title="查看">
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
                                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold mb-2 truncate">{item.keywords}</p>
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
