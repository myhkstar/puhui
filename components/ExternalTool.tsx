import React, { useEffect } from 'react';
import { userService } from '../services/userService';

interface ExternalToolProps {
    url: string;
    featureName: string;
}

const ExternalTool: React.FC<ExternalToolProps> = ({ url, featureName }) => {
    useEffect(() => {
        userService.logUsage(featureName);
    }, [featureName]);

    return (
        <div className="w-full h-[calc(100vh-100px)] mt-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
            <iframe 
                src={url} 
                className="w-full h-full border-none"
                title={featureName}
            />
        </div>
    );
};

export default ExternalTool;