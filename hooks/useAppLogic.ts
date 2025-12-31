import { useState, useEffect } from 'react';
import { GeneratedImage, ComplexityLevel, VisualStyle, Language, AspectRatio, SearchResultItem, User } from '../types';
import { researchTopicForPrompt, generateInfographicImage, editInfographicImage } from '../services/geminiService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';

export const useAppLogic = () => {
    const { currentUser, setCurrentUser, updateCurrentUser, logout: authLogout } = useAuth();

    const [showIntro, setShowIntro] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [currentView, setCurrentView] = useState<'home' | 'profile' | 'admin' | 'image-gen' | 'student-ai' | 'smart-tools' | 'ai-assistant'>('home');

    const [topic, setTopic] = useState('');
    const [complexityLevel, setComplexityLevel] = useState<ComplexityLevel>('High School');
    const [visualStyle, setVisualStyle] = useState<VisualStyle>('Default');
    const [language, setLanguage] = useState<Language>('Traditional Chinese');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingStep, setLoadingStep] = useState<number>(0);
    const [loadingFacts, setLoadingFacts] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
    const [currentSearchResults, setCurrentSearchResults] = useState<SearchResultItem[]>([]);
    const [isDarkMode, setIsDarkMode] = useState(true);

    const [hasApiKey, setHasApiKey] = useState(false);
    const [checkingKey, setCheckingKey] = useState(true);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    useEffect(() => {
        const init = async () => {
            try {
                if (window.aistudio && window.aistudio.hasSelectedApiKey) {
                    const hasKey = await window.aistudio.hasSelectedApiKey();
                    setHasApiKey(hasKey);
                } else {
                    setHasApiKey(true);
                }
            } catch (e) {
                console.error("Error checking API key:", e);
            } finally {
                setCheckingKey(false);
            }

            if (currentUser && currentUser.history) {
                setImageHistory(currentUser.history);
            }
        };
        init();
    }, [currentUser]);

    const handleSelectKey = async () => {
        if (window.aistudio && window.aistudio.openSelectKey) {
            try {
                await window.aistudio.openSelectKey();
                setHasApiKey(true);
                setError(null);
            } catch (e) {
                console.error("Failed to open key selector:", e);
            }
        }
    };

    const handleLoginSuccess = (user: User) => {
        setCurrentUser(user);
        if (user.role === 'admin') {
            setCurrentView('admin');
        } else {
            setCurrentView('home');
        }
        setShowAuthModal(false);
    };

    const handleLogout = async () => {
        await authLogout();
        setCurrentView('home');
        setImageHistory([]);
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        if (!currentUser) {
            setShowAuthModal(true);
            return;
        }

        if (!topic.trim()) {
            setError("請輸入要視覺化的主題。");
            return;
        }

        setIsLoading(true);
        setError(null);
        setLoadingStep(1);
        setLoadingFacts([]);
        setCurrentSearchResults([]);
        setLoadingMessage(`正在研究主題...`);

        try {
            if (!currentUser?.token) throw new Error("Authentication token is missing.");
            const researchResult = await researchTopicForPrompt(topic, complexityLevel, visualStyle, language, aspectRatio, currentUser.token);
            let totalTokens = researchResult.usage || 0;

            setLoadingFacts(researchResult.facts);
            setCurrentSearchResults(researchResult.searchResults);

            setLoadingStep(2);
            setLoadingMessage(`正在設計資訊圖表...`);

            const genResult = await generateInfographicImage(researchResult.imagePrompt, aspectRatio, currentUser.token);
            totalTokens += genResult.usage;

            const newImage: GeneratedImage = {
                id: Date.now().toString(),
                data: genResult.content,
                prompt: topic,
                timestamp: Date.now(),
                level: complexityLevel,
                style: visualStyle,
                language: language,
                aspectRatio: aspectRatio,
                usage: totalTokens,
                facts: researchResult.facts
            };

            setImageHistory([newImage, ...imageHistory]);

            try {
                await userService.saveUserImage(currentUser, newImage);
                const usageResult = await userService.logUsage('可視化引擎', totalTokens);
                if (usageResult.remainingTokens !== undefined) {
                    updateCurrentUser({ tokens: usageResult.remainingTokens });
                }
            } catch (e) {
                console.error("Failed to save to cloud history", e);
            }

        } catch (err: any) {
            console.error(err);
            if (err.message && (err.message.includes("Requested entity was not found") || err.message.includes("404") || err.message.includes("403"))) {
                setError("存取被拒絕。選定的 API 金鑰無法存取所需模型。請選擇一個已啟用計費的專案。");
                setHasApiKey(false);
            } else {
                setError('圖像生成服務暫時無法使用，請稍後再試。');
            }
        } finally {
            setIsLoading(false);
            setLoadingStep(0);
        }
    };

    const handleEdit = async (editPrompt: string) => {
        if (imageHistory.length === 0) return;
        const currentImage = imageHistory[0];
        setIsLoading(true);
        setError(null);
        setLoadingStep(2);
        setLoadingMessage(`正在處理修改： "${editPrompt}"...`);

        try {
            if (!currentUser?.token) throw new Error("User not authenticated for editing");
            const editResult = await editInfographicImage(currentImage.data, editPrompt, currentUser.token);
            const newImage: GeneratedImage = {
                id: Date.now().toString(),
                data: editResult.content,
                prompt: editPrompt,
                timestamp: Date.now(),
                level: currentImage.level,
                style: currentImage.style,
                language: currentImage.language,
                aspectRatio: currentImage.aspectRatio,
                usage: editResult.usage,
                facts: currentImage.facts
            };

            setImageHistory([newImage, ...imageHistory]);

            await userService.saveUserImage(currentUser, newImage);
            const usageResult = await userService.logUsage('可視化引擎', editResult.usage);
            if (usageResult.remainingTokens !== undefined) {
                updateCurrentUser({ tokens: usageResult.remainingTokens });
            }

        } catch (err: any) {
            console.error(err);
            if (err.message && (err.message.includes("Requested entity was not found") || err.message.includes("404") || err.message.includes("403"))) {
                setError("存取被拒絕。請選擇一個已啟用計費的有效 API 金鑰。");
                setHasApiKey(false);
            } else {
                setError('修改失敗，請嘗試不同的指令。');
            }
        } finally {
            setIsLoading(false);
            setLoadingStep(0);
        }
    };

    const restoreImage = (img: GeneratedImage) => {
        const newHistory = imageHistory.filter(i => i.id !== img.id);
        setImageHistory([img, ...newHistory]);
        setCurrentView('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleNavClick = (view: typeof currentView) => {
        if (!currentUser) {
            setShowAuthModal(true);
        } else {
            setCurrentView(view);
        }
    };

    return {
        currentUser,
        updateCurrentUser,
        showIntro, setShowIntro,
        showAuthModal, setShowAuthModal,
        currentView, setCurrentView,
        topic, setTopic,
        complexityLevel, setComplexityLevel,
        visualStyle, setVisualStyle,
        language, setLanguage,
        aspectRatio, setAspectRatio,
        isLoading, loadingMessage, loadingStep, loadingFacts,
        error, setError,
        imageHistory, currentSearchResults,
        isDarkMode, setIsDarkMode,
        hasApiKey, checkingKey,
        handleSelectKey, handleLoginSuccess, handleLogout,
        handleGenerate, handleEdit, restoreImage, handleNavClick
    };
};
