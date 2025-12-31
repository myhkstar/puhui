
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { ComplexityLevel, VisualStyle, Language, AspectRatio } from './types';
import Infographic from './components/Infographic';
import Loading from './components/Loading';
import IntroScreen from './components/IntroScreen';
import SearchResults from './components/SearchResults';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import AIAssistant from './components/AIAssistant';
import SmartTools from './components/ExternalTool';
import KeySelectionModal from './components/KeySelectionModal';
import NavButton from './components/NavButton';
import { useAppLogic } from './hooks/useAppLogic';

import { Search, AlertCircle, History, GraduationCap, Palette, Microscope, Atom, Compass, Globe, Sun, Moon, CreditCard, ExternalLink, DollarSign, User as UserIcon, LogOut, Shield, FileText, BarChart, MessageSquare, Layout, Info, Lightbulb } from 'lucide-react';

const App: React.FC = () => {
    const {
        currentUser, updateCurrentUser,
        showIntro, setShowIntro,
        showAuthModal, setShowAuthModal,
        currentView, setCurrentView,
        topic, setTopic,
        complexityLevel, setComplexityLevel,
        visualStyle, setVisualStyle,
        language, setLanguage,
        aspectRatio, setAspectRatio,
        isLoading, loadingMessage, loadingStep, loadingFacts,
        error,
        imageHistory, lastResearchResult, currentSearchResults,
        isDarkMode, setIsDarkMode,
        hasApiKey, checkingKey,
        handleSelectKey, handleLoginSuccess, handleLogout,
        handleGenerate, handleEdit, restoreImage, handleNavClick
    } = useAppLogic();

    if (checkingKey && !hasApiKey) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <>
            {!checkingKey && !hasApiKey && <KeySelectionModal onSelectKey={handleSelectKey} />}

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onLoginSuccess={handleLoginSuccess}
            />

            {showIntro ? (
                <IntroScreen onComplete={() => setShowIntro(false)} />
            ) : (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500 selection:text-white pb-20 relative overflow-x-hidden animate-in fade-in duration-1000 transition-colors">

                    {/* Background Elements */}
                    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white dark:from-indigo-900 dark:via-slate-950 dark:to-black z-0 transition-colors"></div>
                    <div className="fixed inset-0 opacity-5 dark:opacity-20 z-0 pointer-events-none" style={{
                        backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
                        backgroundSize: '40px 40px'
                    }}></div>

                    {/* Navbar - Fixed Position */}
                    <header className="border-b border-slate-200 dark:border-white/10 fixed top-0 w-full z-50 backdrop-blur-md bg-white/70 dark:bg-slate-950/60 transition-colors">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 md:h-20 flex items-center justify-between">
                            <div className="flex items-center gap-3 md:gap-4 group cursor-pointer" onClick={() => setCurrentView('home')}>
                                <div className="relative scale-90 md:scale-100">
                                    <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20 dark:opacity-40 group-hover:opacity-60 transition-opacity"></div>
                                    <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 relative z-10 shadow-sm dark:shadow-none">
                                        <Atom className="w-6 h-6 text-cyan-600 dark:text-cyan-400 animate-[spin_10s_linear_infinite]" />
                                    </div>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-display font-bold text-lg md:text-2xl tracking-tight text-slate-900 dark:text-white leading-none">
                                        普會AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-400 dark:to-amber-400">Puhui</span>
                                    </span>
                                    <span className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-medium">讓AI普會，普惠，普慧</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="hidden lg:flex items-center gap-2 mr-2">
                                    <NavButton icon={GraduationCap} label="中學生AI" view="student-ai" currentView={currentView} onClick={handleNavClick} />
                                    <NavButton icon={FileText} label="智能工具" view="smart-tools" currentView={currentView} onClick={handleNavClick} />
                                    <NavButton icon={BarChart} label="可視化引擎" view="home" currentView={currentView} onClick={handleNavClick} />
                                    <NavButton icon={MessageSquare} label="深聊淺談" view="ai-assistant" currentView={currentView} onClick={handleNavClick} />
                                </div>

                                {currentUser ? (
                                    <>
                                        {currentUser.role === 'admin' && (
                                            <button
                                                onClick={() => setCurrentView('admin')}
                                                className={`p-2 md:px-3 md:py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${currentView === 'admin' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                            >
                                                <Shield className="w-4 h-4" />
                                                <span className="hidden md:inline">後台</span>
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setCurrentView('profile')}
                                            className={`p-2 md:px-3 md:py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${currentView === 'profile' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                                        >
                                            <UserIcon className="w-4 h-4" />
                                            <span className="hidden md:inline">{currentUser.displayName || currentUser.username}</span>
                                        </button>

                                        <button
                                            onClick={handleLogout}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                            title="登出"
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => setShowAuthModal(true)}
                                        className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                                    >
                                        <UserIcon className="w-3 h-3" /> 登入 / 註冊
                                    </button>
                                )}

                                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

                                <button
                                    onClick={() => setIsDarkMode(!isDarkMode)}
                                    className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors border border-slate-200 dark:border-white/10 shadow-sm"
                                    title={isDarkMode ? "切換至淺色模式" : "切換至深色模式"}
                                >
                                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Mobile Navigation */}
                        <div className="lg:hidden flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-white/10 overflow-x-auto gap-2">
                            <NavButton icon={GraduationCap} label="中學生" view="student-ai" currentView={currentView} onClick={handleNavClick} />
                            <NavButton icon={FileText} label="工具" view="smart-tools" currentView={currentView} onClick={handleNavClick} />
                            <NavButton icon={BarChart} label="可視化" view="home" currentView={currentView} onClick={handleNavClick} />
                            <NavButton icon={MessageSquare} label="深聊淺談" view="ai-assistant" currentView={currentView} onClick={handleNavClick} />
                        </div>
                    </header>

                    {/* Main Content with Top Padding to accommodate fixed header */}
                    <main className="px-3 sm:px-6 pt-32 pb-4 md:pt-28 md:pb-8 relative z-10">

                        {/* VIEW: ADMIN PANEL */}
                        {currentView === 'admin' && currentUser?.role === 'admin' && (
                            <AdminDashboard />
                        )}

                        {/* VIEW: USER PROFILE */}
                        {currentView === 'profile' && currentUser && (
                            <UserDashboard user={currentUser} onRestore={restoreImage} onUpdateUser={updateCurrentUser} />
                        )}

                        {/* VIEW: NEW FEATURES */}
                        {currentView === 'ai-assistant' && <AIAssistant user={currentUser} />}
                        {currentView === 'student-ai' && <SmartTools user={currentUser} onUpdateUser={updateCurrentUser} />}

                        {/* VIEW: SMART TOOLS (Under Construction) */}
                        {currentView === 'smart-tools' && <SmartTools user={currentUser} onUpdateUser={updateCurrentUser} />}

                        {/* VIEW: HOME / VISUALIZATION ENGINE */}
                        {currentView === 'home' && (
                            <>
                                <div className={`max-w-6xl mx-auto transition-all duration-500 ${imageHistory.length > 0 ? 'mb-4 md:mb-8' : 'min-h-[50vh] md:min-h-[70vh] flex flex-col justify-center'}`}>

                                    {!imageHistory.length && (
                                        <div className="text-center mb-6 md:mb-16 space-y-3 md:space-y-8 animate-in slide-in-from-bottom-8 duration-700 fade-in">
                                            <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-300 text-[10px] md:text-xs font-bold tracking-widest uppercase shadow-sm dark:shadow-[0_0_20px_rgba(251,191,36,0.1)] backdrop-blur-sm">
                                                <Compass className="w-3 h-3 md:w-4 md:h-4" /> 探索歷史、科學等廣闊主題。
                                            </div>
                                            <h1 className="text-3xl sm:text-5xl md:text-8xl font-display font-bold text-slate-900 dark:text-white tracking-tight leading-[0.95] md:leading-[0.9]">
                                                可視化

                                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-indigo-400 dark:to-purple-400">引擎</span>
                                            </h1>
                                            <p className="text-sm md:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-light leading-relaxed px-4">
                                                你的PPT或研究報告需要什麽樣的圖表？請在下面試一試……
                                            </p>
                                        </div>
                                    )}

                                    {/* Search Form */}
                                    <form onSubmit={handleGenerate} className={`relative z-20 transition-all duration-300 ${isLoading ? 'opacity-50 pointer-events-none scale-95 blur-sm' : 'scale-100'}`}>

                                        <div className="relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-amber-500 rounded-3xl opacity-10 dark:opacity-20 group-hover:opacity-30 dark:group-hover:opacity-40 transition duration-500 blur-xl"></div>

                                            <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-2 rounded-3xl shadow-2xl">

                                                {/* Main Input */}
                                                <div className="relative flex items-center">
                                                    <Search className="absolute left-4 md:left-6 w-5 h-5 md:w-6 md:h-6 text-slate-400 group-focus-within:text-cyan-500 transition-colors" />
                                                    <input
                                                        type="text"
                                                        value={topic}
                                                        onChange={(e) => setTopic(e.target.value)}
                                                        placeholder="您想視覺化什麼？"
                                                        className="w-full pl-12 md:pl-16 pr-4 md:pr-6 py-3 md:py-6 bg-transparent border-none outline-none text-base md:text-2xl placeholder:text-slate-400 font-medium text-slate-900 dark:text-white"
                                                    />
                                                </div>

                                                {/* Controls Bar */}
                                                <div className="flex flex-wrap gap-2 p-2 mt-2">

                                                    {/* Level Selector */}
                                                    <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 hover:border-cyan-500/30 transition-colors relative overflow-hidden group/item">
                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-cyan-600 dark:text-cyan-400 shrink-0 shadow-sm">
                                                            <GraduationCap className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col z-10 w-full overflow-hidden">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">受眾</label>
                                                            <select
                                                                value={complexityLevel}
                                                                onChange={(e) => setComplexityLevel(e.target.value as ComplexityLevel)}
                                                                className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 w-full hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors truncate pr-4 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                                                            >
                                                                <option value="Elementary">小學</option>
                                                                <option value="High School">高中</option>
                                                                <option value="College">大學</option>
                                                                <option value="Expert">專家</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Style Selector */}
                                                    <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 hover:border-purple-500/30 transition-colors relative overflow-hidden group/item">
                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-purple-600 dark:text-purple-400 shrink-0 shadow-sm">
                                                            <Palette className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col z-10 w-full overflow-hidden">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">美學風格</label>
                                                            <select
                                                                value={visualStyle}
                                                                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                                                                className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 w-full hover:text-purple-600 dark:hover:text-purple-300 transition-colors truncate pr-4 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                                                            >
                                                                <option value="Default">標準科學</option>
                                                                <option value="Minimalist">極簡主義</option>
                                                                <option value="Realistic">寫實照片</option>
                                                                <option value="Cartoon">圖形小說</option>
                                                                <option value="Vintage">復古版畫</option>
                                                                <option value="Futuristic">賽博龐克介面</option>
                                                                <option value="3D Render">3D 等距模型</option>
                                                                <option value="Sketch">技術藍圖</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Language Selector */}
                                                    <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 hover:border-green-500/30 transition-colors relative overflow-hidden group/item">
                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-green-600 dark:text-green-400 shrink-0 shadow-sm">
                                                            <Globe className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col z-10 w-full overflow-hidden">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">語言</label>
                                                            <select
                                                                value={language}
                                                                onChange={(e) => setLanguage(e.target.value as Language)}
                                                                className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 w-full hover:text-green-600 dark:hover:text-green-300 transition-colors truncate pr-4 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                                                            >
                                                                <option value="Traditional Chinese">繁體中文</option>
                                                                <option value="Mandarin">简体中文</option>
                                                                <option value="English">英文</option>
                                                                <option value="Spanish">西班牙文</option>
                                                                <option value="French">法文</option>
                                                                <option value="German">德文</option>
                                                                <option value="Japanese">日文</option>
                                                                <option value="Hindi">印地文</option>
                                                                <option value="Arabic">阿拉伯文</option>
                                                                <option value="Portuguese">葡萄牙文</option>
                                                                <option value="Russian">俄文</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Format (AspectRatio) Selector */}
                                                    <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-white/5 px-4 py-3 flex items-center gap-3 hover:border-amber-500/30 transition-colors relative overflow-hidden group/item">
                                                        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-amber-600 dark:text-amber-400 shrink-0 shadow-sm">
                                                            <Layout className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col z-10 w-full overflow-hidden">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">規格 (Format)</label>
                                                            <select
                                                                value={aspectRatio}
                                                                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                                                className="bg-transparent border-none text-base font-bold text-slate-900 dark:text-slate-100 focus:ring-0 cursor-pointer p-0 w-full hover:text-amber-600 dark:hover:text-amber-300 transition-colors truncate pr-4 [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
                                                            >
                                                                <option value="16:9">16:9 (寬螢幕)</option>
                                                                <option value="4:3">4:3 (標準)</option>
                                                                <option value="1:1">1:1 (正方形)</option>
                                                                <option value="3:4">3:4 (縱向)</option>
                                                                <option value="9:16">9:16 (手機)</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Generate Button */}
                                                    <div className="flex flex-col gap-1 w-full md:w-auto">
                                                        <button
                                                            type="submit"
                                                            disabled={isLoading}
                                                            className="w-full md:w-auto h-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 py-4 rounded-2xl font-bold font-display tracking-wide hover:brightness-110 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                                        >
                                                            <Microscope className="w-5 h-5" />
                                                            <span>啟動</span>
                                                        </button>
                                                        <div className="text-center">
                                                            <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider opacity-70">{aspectRatio} 格式</span>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    </form>
                                </div>

                                {isLoading && <Loading status={loadingMessage} step={loadingStep} facts={loadingFacts} />}

                                {/* Error Message */}
                                {error && (
                                    <div className="max-w-2xl mx-auto mt-8 p-6 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-center gap-4 text-red-800 dark:text-red-200 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 shadow-sm">
                                        <AlertCircle className="w-6 h-6 flex-shrink-0 text-red-500 dark:text-red-400" />
                                        <div className="flex-1">
                                            <p className="font-medium">{error}</p>
                                            {(error.includes("Access denied") || error.includes("billing") || error.includes("存取被拒絕")) && (
                                                <button
                                                    onClick={handleSelectKey}
                                                    className="mt-2 text-xs font-bold text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-100"
                                                >
                                                    選擇不同的 API 金鑰
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {(imageHistory.length > 0 || lastResearchResult) && !isLoading && (
                                    <>
                                        {imageHistory.length > 0 && (
                                            <Infographic
                                                image={imageHistory[0]}
                                                onEdit={handleEdit}
                                                isEditing={isLoading}
                                            />
                                        )}

                                        {/* New Info Section: Tokens & Facts */}
                                        <div className="max-w-6xl mx-auto mt-4 px-4 sm:px-0">
                                            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm">
                                                <div className="flex flex-col md:flex-row gap-8">
                                                    {/* Token Info */}
                                                    <div className="shrink-0 flex md:flex-col items-center md:items-start gap-4 md:gap-2">
                                                        <div className="p-2.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-xl">
                                                            <Info className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">生成耗用</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xl font-display font-bold text-slate-900 dark:text-white">
                                                                    {(imageHistory.length > 0 ? imageHistory[0].usage : lastResearchResult?.usage)?.toLocaleString() || 'N/A'}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-medium">tokens</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Divider */}
                                                    <div className="hidden md:block w-px bg-slate-200 dark:bg-slate-800 self-stretch"></div>

                                                    {/* Facts */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                                                <Lightbulb className="w-4 h-4" />
                                                            </div>
                                                            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">核心研究事實</h4>
                                                        </div>
                                                        <ul className="space-y-3">
                                                            {(imageHistory.length > 0 ? imageHistory[0].facts : lastResearchResult?.facts)?.map((fact, idx) => (
                                                                <li key={idx} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed group">
                                                                    <span className="w-5 h-5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-bold text-slate-400 group-hover:text-amber-500 transition-colors shrink-0">
                                                                        {idx + 1}
                                                                    </span>
                                                                    {fact}
                                                                </li>
                                                            )) || <li className="text-slate-400 italic">尚無資料</li>}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <SearchResults results={currentSearchResults} />
                                    </>
                                )}

                                {imageHistory.length > 1 && (
                                    <div className="max-w-7xl mx-auto mt-16 md:mt-24 border-t border-slate-200 dark:border-white/10 pt-12 transition-colors">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                            <History className="w-4 h-4" />
                                            工作階段存檔 (Session)
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
                                            {imageHistory.slice(1).map((img) => (
                                                <div
                                                    key={img.id}
                                                    onClick={() => restoreImage(img)}
                                                    className="group relative cursor-pointer rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 hover:border-cyan-500/50 transition-all shadow-lg bg-white dark:bg-slate-900/50 backdrop-blur-sm"
                                                >
                                                    <img src={img.data} alt={img.prompt} className="w-full aspect-video object-cover opacity-90 dark:opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                                        <p className="text-xs text-white font-bold truncate mb-1 font-display">{img.prompt}</p>
                                                        <div className="flex gap-2">
                                                            {img.level && <span className="text-[9px] text-cyan-100 uppercase font-bold tracking-wide px-1.5 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-500/20">{img.level}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                    </main>
                </div>
            )}
        </>
    );
};

export default App;
