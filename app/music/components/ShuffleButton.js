import React from 'react';
import { Shuffle } from "lucide-react";


const ShuffleButton = React.memo(({ currentSong, stuffle }) => {
    return (
        <button
            onClick={stuffle}
            className={`fixed right-6 bg-[#fa4565] text-white p-4 rounded-full shadow-xl 
                hover:scale-105 active:scale-95 transition z-50
                ${currentSong ? "bottom-[100px]" : "bottom-6"} 
            `}
            title="Shuffle Play"
        >
            <Shuffle className="w-6 h-6" />
        </button>
    );
});

ShuffleButton.displayName = 'ShuffleButton';

export default ShuffleButton;