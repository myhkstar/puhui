import React from 'react';

interface NavButtonProps {
    icon: any;
    label: string;
    view: string;
    currentView: string;
    onClick: (view: any) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon: Icon, label, view, currentView, onClick }) => (
    <button
        onClick={() => onClick(view)}
        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${currentView === view
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                : 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-900/50'
            }`}
    >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{label}</span>
    </button>
);

export default NavButton;
