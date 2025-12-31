import React, { useState, useRef, useContext } from 'react';
import { Camera, Upload, Wand2, Loader2, X, Check, RefreshCw } from 'lucide-react';
import { beautifyImage, analyzeImage } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext';

const prompt1 = `这是一张手机拍的人像照片，请进行专业人像后期（保持真实人像摄影风格，不要卡通或油画化）：
- 显著提升面部和眼睛的清晰度与细节，锐化眼睛但自然；不要擅自给人物眼睛添加双眼皮，除非图片中人物眼睛本身就是双眼皮
- 磨皮但保留真实皮肤纹理，绝不塑料感
- 优化肤色，纠正偏黄/偏红的光线，还原健康自然肤色
- 背景轻微虚化，提升主体突出感，但不要过度
  保持图片人物面部特征保持一致。`;

const prompt2 = `手机拍摄的[具体物体，比如手办/美食/产品]，请大幅提升细节与质感：
- 极致锐化主体，纹理清晰可见（毛发/食材纹理/布料纤维等）
- 增强微观细节和反光高光
- 优化光影层次，增加立体感
- 校正手机镜头常见的枕形畸变和暗角
- 提高局部对比度（微对比），让材质感爆棚
- 整体色调自然高级，像单反+神灯拍摄
不要过度饱和，不要滤镜感`;

const prompt3 = `这是一张用手机拍摄的照片，请帮我专业后期修复：
- 显著提升主体清晰度和细节，锐化但不过度
- 纠正手抖或轻微失焦造成的模糊
- 优化曝光和对比度，让光线自然柔和，像自然光下拍摄的效果
- 智能降噪，保留皮肤/物体真实质感
- 校正白平衡，去除手机常见的偏黄/偏蓝色温
- 轻微提升饱和度和动态范围，但保持真实感，不要像滤镜
风格参考：iPhone原生相机「摄影风格-鲜艳」或专业摄影师用Lightroom调出的自然通透感`;

const OneClickBeautify: React.FC = () => {
    const { currentUser } = useAuth();
    const [image, setImage] = useState<string | null>(null);
    const [beautifiedImage, setBeautifiedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [analysisCategory, setAnalysisCategory] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setCameraStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraOpen(true);
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("無法存取相機，請確保已授權相機權限。");
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraOpen(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setImage(dataUrl);
                setBeautifiedImage(null);
                setAnalysisCategory(null);
                stopCamera();
            }
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
                setBeautifiedImage(null);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleBeautify = async () => {
        if (!image || !currentUser?.token) return;
        setIsLoading(true);

        try {
            // 1. Analyze image content
            const { category } = await analyzeImage(image, currentUser.token);
            setAnalysisCategory(category);

            // 2. Select appropriate prompt
            let selectedPrompt = prompt3;
            if (category === 'person') {
                selectedPrompt = prompt1;
            } else if (category === 'object') {
                selectedPrompt = prompt2;
            }

            // 3. Beautify image
            const result = await beautifyImage(image, selectedPrompt, currentUser.token);
            setBeautifiedImage(result.content);
        } catch (error) {
            console.error("Failed to beautify image:", error);
            alert("美化圖片失敗，請稍後再試。");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold mb-6">一键美图</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg">
                    {!image ? (
                        <div className="text-center">
                            <button onClick={() => fileInputRef.current?.click()} className="w-full">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-2 text-sm font-medium">上传图片</h3>
                            </button>
                            <p className="mt-1 text-sm text-gray-500">或</p>
                            <button
                                type="button"
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 mt-2"
                                onClick={startCamera}
                            >
                                <Camera className="-ml-1 mr-2 h-5 w-5" />
                                使用相機
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                        </div>
                    ) : (
                        <div className="relative w-full">
                            <img src={beautifiedImage || image} alt="Preview" className="w-full h-auto rounded-lg shadow-lg" />
                            {beautifiedImage && (
                                <div className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                                    已美化
                                </div>
                            )}
                            {analysisCategory && !beautifiedImage && (
                                <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                                    識別為: {analysisCategory === 'person' ? '人物' : analysisCategory === 'object' ? '物體/商品' : '其他'}
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setImage(null);
                                    setBeautifiedImage(null);
                                    setAnalysisCategory(null);
                                }}
                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-4">
                    {image && (
                        <>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                <h4 className="text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">處理邏輯：</h4>
                                <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-400">
                                    <li className={analysisCategory === 'person' ? 'text-cyan-600 font-bold' : ''}>• 人像：專業後期，提升清晰度，還原膚色</li>
                                    <li className={analysisCategory === 'object' ? 'text-cyan-600 font-bold' : ''}>• 物體/商品：增強質感，銳化細節，優化光影</li>
                                    <li className={analysisCategory === 'other' ? 'text-cyan-600 font-bold' : ''}>• 其他：專業修復，糾正模糊，優化曝光</li>
                                </ul>
                            </div>
                            <button
                                onClick={handleBeautify}
                                disabled={isLoading}
                                className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                        正在分析並處理...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="-ml-1 mr-2 h-5 w-5" />
                                        一鍵美化
                                    </>
                                )}
                            </button>
                            {beautifiedImage && (
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = beautifiedImage;
                                        link.download = 'beautified_image.png';
                                        link.click();
                                    }}
                                    className="w-full inline-flex justify-center items-center px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-bold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                >
                                    下載美化後的圖片
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Camera Modal */}
            {isCameraOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
                    <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Camera className="w-5 h-5 text-cyan-400" /> 拍攝照片
                            </h3>
                            <button onClick={stopCamera} className="text-white/60 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="relative aspect-video bg-black">
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6 flex justify-center gap-4">
                            <button
                                onClick={stopCamera}
                                className="px-6 py-2 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={capturePhoto}
                                className="px-8 py-2 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600 shadow-lg shadow-cyan-500/30 transition-all flex items-center gap-2"
                            >
                                <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
                                拍照
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default OneClickBeautify;
