import React from 'react';

const PPTGenerator: React.FC = () => {
    return (
        <div className="w-full h-full flex flex-col">
            <iframe
                src="https://aippg-54124599328.us-west1.run.app/"
                title="PPT Generator"
                className="w-full h-full border-none flex-1"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        </div>
    );
};

export default PPTGenerator;
