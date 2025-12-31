import React, { useState, useEffect, useRef } from 'react';
import { userService } from '../../services/userService';
import {
    Mic, Square, Upload, FileText, Sparkles,
    CheckCircle, AlertCircle, Loader2, Download,
    Trash2, History, X, Play, Pause, Volume2
} from 'lucide-react';

interface Transcript {
    id: string;
    title: string;
    keywords: string;
    content: string;
    createdAt: number;
}

const MeetingNotes: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [originalText, setOriginalText] = useState('');
    const [refinedText, setRefinedText] = useState('');
    const [activeTab, setActiveTab] = useState<'original' | 'refined'>('refined');
    const [error, setError] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [history, setHistory] = useState<Transcript[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadHistory();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
        };
    }, []);

    const loadHistory = async () => {
        try {
            const data = await userService.getTranscriptHistory();
            setHistory(data);
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
                processAudio(blob);
            };

            // Audio Visualization
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            drawWaveform();

            mediaRecorder.start();
            setIsRecording(true);
            setOriginalText('');
            setRefinedText('');
            setError(null);
        } catch (err) {
            console.error("Error accessing microphone", err);
            setError("無法存取麥克風，請檢查權限設置。");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        }
    };

    const drawWaveform = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current!.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;

                // Gradient for bars
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                gradient.addColorStop(0, '#06b6d4'); // cyan-500
                gradient.addColorStop(1, '#3b82f6'); // blue-500

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const processAudio = async (blob: Blob) => {
        setIsTranscribing(true);
        setActiveTab('original');
        try {
            const base64 = await blobToBase64(blob);
            const stream = userService.streamTranscript(base64, blob.type);

            let fullTranscript = '';
            for await (const chunk of stream) {
                fullTranscript += chunk;
                setOriginalText(fullTranscript);
            }

            // Start refinement
            setIsRefining(true);
            const refined = await userService.refineTranscript(fullTranscript);
            setRefinedText(refined);
            setActiveTab('refined');

            // Save to history (optional, or let user save manually)
            // For now, we just update the local state
            loadHistory();
        } catch (err: any) {
            console.error("Processing failed", err);
            setError(err.message || "處理失敗，請稍後再試。");
        } finally {
            setIsTranscribing(false);
            setIsRefining(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAudioBlob(file);
            processAudio(file);
        }
    };

    const handleDownload = () => {
        const text = activeTab === 'refined' ? refinedText : originalText;
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `會議筆記-${new Date().toLocaleDateString()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto min-h-full bg-slate-50/50 dark:bg-slate-950/50">
            {/* Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-cyan-500" />
                        多模態語音筆記
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        利用 Gemini 2.5 Flash 直接「聽」懂您的錄音，將混亂轉化為精煉筆記。
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group"
                        title="上傳音檔"
                    >
                        <Upload className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-cyan-500" />
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
                    </button>
                    <button
                        onClick={loadHistory}
                        className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group"
                        title="歷史記錄"
                    >
                        <History className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-cyan-500" />
                    </button>
                </div>
            </div>

            {/* Main Content Area - Glassmorphism Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Recording & Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 shadow-2xl shadow-cyan-500/5">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-500/10 scale-110' : 'bg-cyan-500/10'}`}>
                                {isRecording && (
                                    <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping"></div>
                                )}
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={isTranscribing || isRefining}
                                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/30'}`}
                                >
                                    {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
                                </button>
                            </div>

                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">
                                    {isRecording ? '正在錄音中...' : isTranscribing ? '正在轉錄中...' : isRefining ? '正在精煉筆記...' : '準備就緒'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {isRecording ? '點擊按鈕停止錄製' : '點擊按鈕開始錄製語音筆記'}
                                </p>
                            </div>

                            {/* Waveform Canvas */}
                            <canvas
                                ref={canvasRef}
                                width={200}
                                height={60}
                                className={`w-full h-16 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 transition-opacity duration-300 ${isRecording ? 'opacity-100' : 'opacity-30'}`}
                            />
                        </div>
                    </div>

                    {/* Status Indicators */}
                    {(isTranscribing || isRefining) && (
                        <div className="backdrop-blur-md bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                                <span>AI 處理進度</span>
                                <span>{isRefining ? '90%' : '40%'}</span>
                            </div>
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000 ${isRefining ? 'w-[90%]' : 'w-[40%]'}`}
                                ></div>
                            </div>
                            <p className="text-[10px] text-slate-500 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {isRefining ? '正在優化文案結構與邏輯...' : '正在將語音轉化為文字...'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 p-4 rounded-2xl flex items-start gap-3 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>{error}</p>
                        </div>
                    )}
                </div>

                {/* Right Column: Results & Tabs */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
                        {/* Tabs Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button
                                    onClick={() => setActiveTab('refined')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'refined' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    精煉筆記
                                </button>
                                <button
                                    onClick={() => setActiveTab('original')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'original' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    原始轉錄
                                </button>
                            </div>

                            <button
                                onClick={handleDownload}
                                disabled={!refinedText && !originalText}
                                className="p-2 text-slate-400 hover:text-cyan-500 disabled:opacity-30 transition-colors"
                                title="下載 Markdown"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            {activeTab === 'refined' ? (
                                refinedText ? (
                                    <div className="prose dark:prose-invert max-w-none">
                                        {/* Simple Markdown rendering fallback if react-markdown is not available */}
                                        <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {refinedText}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50">
                                        <Sparkles className="w-12 h-12" />
                                        <p className="text-sm">AI 整理後的精煉筆記將顯示在此</p>
                                    </div>
                                )
                            ) : (
                                originalText ? (
                                    <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                        {originalText}
                                        {isTranscribing && <span className="inline-block w-1.5 h-4 bg-cyan-500 animate-pulse ml-1 align-middle"></span>}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50">
                                        <FileText className="w-12 h-12" />
                                        <p className="text-sm">原始錄音轉錄文字將顯示在此</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* History Grid */}
            {history.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <History className="w-4 h-4" />
                        最近的語音筆記
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.slice(0, 6).map((item) => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    setRefinedText(item.content);
                                    setOriginalText(''); // We don't store original in this simplified history
                                    setActiveTab('refined');
                                }}
                                className="group bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 p-4 rounded-2xl hover:border-cyan-500/30 transition-all cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                                        <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate mb-1">{item.title}</h4>
                                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold truncate">{item.keywords}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingNotes;
