import React, { useState, useRef } from 'react';
import { generateSimpleImage } from '../services/geminiService';
import { userService } from '../services/userService';
import { User, GeneratedImage } from '../types';
import { Image, Upload, Loader2, Download, X } from 'lucide-react';

interface ImageGeneratorProps {
    user: User | null;
    onUpdateUser: (updates: Partial<User>) => void;
}

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ user, onUpdateUser }) => {
    const [prompt, setPrompt] = useState('');
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files) as File[];
            if (uploadedImages.length + files.length > 2) {
                setError("最多只能上傳兩張參考圖片");
                return;
            }

            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setUploadedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setResultImage(null);

        try {
            const result = await generateSimpleImage(prompt, uploadedImages);
            setResultImage(result.content);
            
            const usageResult = await userService.logUsage('圖片生成', result.usage);
            if (usageResult.remainingTokens !== undefined) {
                onUpdateUser({ tokens: usageResult.remainingTokens });
            }

            // Save to user history if logged in
            if (user) {
                const newImage = {
                    id: Date.now().toString(),
                    data: result.content,
                    prompt: prompt,
                    timestamp: Date.now(),
                };
                await userService.saveGeneratedImage(newImage);
            }

        } catch (err: any) {
            console.error(err);
            setError("生成失敗，請稍後再試。");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold font-display text-slate-900 dark:text-white mb-2">圖片生成</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">使用 Gemini 2.5 Flash Image 快速生成創意圖片</p>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
                <form onSubmit={handleGenerate} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            提示詞
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="描述您想生成的圖片..."
                            className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none resize-none dark:text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            參考圖片 (最多2張)
                        </label>
                        <div className="flex flex-wrap gap-4">
                            {uploadedImages.map((img, idx) => (
                                <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                    <img src={img} alt={`upload-${idx}`} className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {uploadedImages.length < 2 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-cyan-500 hover:text-cyan-500 transition-colors bg-slate-50 dark:bg-slate-800/50"
                                >
                                    <Upload className="w-6 h-6 mb-1" />
                                    <span className="text-xs">上傳</span>
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleFileChange}
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 rounded-xl text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !prompt.trim()}
                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Image className="w-5 h-5" /> 生成圖片</>}
                    </button>
                </form>
            </div>

            {resultImage && (
                <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-8">
                    <img src={resultImage} alt="Generated" className="w-full h-auto rounded-xl shadow-inner" />
                    <div className="mt-4 flex justify-end">
                        <a
                            href={resultImage}
                            download={`generated-${Date.now()}.png`}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                        >
                            <Download className="w-5 h-5" /> 下載圖片
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageGenerator;
