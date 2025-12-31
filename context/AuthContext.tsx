import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { userService } from '../services/userService';

interface AuthContextType {
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    updateCurrentUser: (updates: Partial<User>) => void;
    authLoading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const updateCurrentUser = (updates: Partial<User>) => {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    };

    const logout = async () => {
        await userService.logout();
        setCurrentUser(null);
    };

    useEffect(() => {
        const checkSession = async () => {
            try {
                const user = await userService.checkSession();
                setCurrentUser(user);
            } catch (e) {
                console.error("Auth check failed", e);
            } finally {
                setAuthLoading(false);
            }
        };
        checkSession();
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, setCurrentUser, updateCurrentUser, authLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
