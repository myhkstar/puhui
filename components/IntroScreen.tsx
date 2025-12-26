/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { Play, Sparkles } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState(0); 

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(1), 800);
    const timer2 = setTimeout(() => setPhase(2), 2000);
    const timer3 = setTimeout(() => setPhase(3), 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden font-display cursor-pointer" onClick={onComplete}>
      {/* Background FX */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-black"></div>
      
      <div className="relative z-10 flex flex-col items-center">
        <div className={`transition-all duration-1000 transform ${phase >= 1 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
             <div className="relative w-32 h-32 md:w-48 md:h-48 mb-8">
                <img 
                    src="https://pubpic.puhui.ai/rtlogo/%E5%A6%82%E5%A2%83-%E9%80%8F%E6%98%8E.png" 
                    alt="普會AI Logo" 
                    className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                />
             </div>
        </div>
        
        <h1 className={`text-4xl md:text-6xl font-bold text-white tracking-tighter transition-all duration-1000 ${phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          普會<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">AI</span>
        </h1>
        
        <p className={`mt-4 text-slate-400 text-sm md:text-lg tracking-[0.3em] uppercase transition-all duration-1000 delay-300 ${phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          AI Era，普會，普惠，普慧
        </p>

        <div className={`mt-12 transition-all duration-1000 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button 
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="group relative px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/10 backdrop-blur-sm transition-all overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center gap-2 text-sm font-bold tracking-widest">
                    進入系統 <Play className="w-3 h-3 fill-current" />
                </span>
            </button>
        </div>
      </div>
      
      {/* Decorative Particles */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 animate-pulse delay-700 opacity-20"><Sparkles className="w-4 h-4 text-cyan-200" /></div>
          <div className="absolute bottom-1/3 right-1/4 animate-pulse delay-1000 opacity-20"><Sparkles className="w-6 h-6 text-purple-200" /></div>
      </div>
    </div>
  );
};

export default IntroScreen;