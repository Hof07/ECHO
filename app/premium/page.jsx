"use client"
import React, { useState } from 'react';
import { CheckCircle, Zap, Music4, Download, Infinity, Users, Sun, MonitorPlay, Lock, Sparkle } from 'lucide-react';

// --- Configuration ---
const PRIMARY_ACCENT = '#fa4565'; // The user-requested vibrant red/pink color
const DARK_BACKGROUND = '#111827'; // Tailwind gray-900
const CARD_BACKGROUND = '#1f2937'; // Tailwind gray-800
const SELECTED_CARD_BACKGROUND = '#374151'; // Tailwind gray-700 for subtle highlight

// Data structure for all pricing plans (same as before)
const plans = [
    {
        id: 'standard',
        name: 'Standard (Ad-Supported)',
        price: 0,
        description: 'Essential listening with required advertising.',
        features: [
            { icon: Sun, text: 'Unlimited Streaming' },
            { icon: Music4, text: 'Standard 128kbps Audio', negative: false },
            { icon: MonitorPlay, text: 'Desktop & Mobile Access', negative: false },
            { icon: Lock, text: 'No Offline Downloads', negative: true },
        ],
        tag: 'Free',
    },
    {
        id: 'premium',
        name: 'Premium Solo',
        price: 49,
        description: 'Best value for an individual listener. Ad-free.',
        features: [
            { icon: Zap, text: 'Completely Ad-Free Experience' },
            { icon: Music4, text: 'High Quality 320kbps Audio', negative: false },
            { icon: Download, text: 'Offline Listening (1 device)', negative: false },
            { icon: CheckCircle, text: 'Priority Support Access', negative: false },
        ],
        tag: 'Best Value',
    },
    {
        id: 'hifi',
        name: 'Hi-Fi Duo',
        price: 99,
        description: 'Maximum quality and multi-user support.',
        features: [
            { icon: Infinity, text: 'Lossless Hi-Fi Audio Quality' },
            { icon: Users, text: '2 Simultaneous User Accounts', negative: false },
            { icon: Download, text: 'Unlimited Offline Downloads', negative: false },
            { icon: CheckCircle, text: 'Exclusive Early Access Content', negative: false },
            { icon: Sparkle, text: 'AURA Ai support', negative: false },
        ],
        tag: 'Ultimate',
    }
];

// Feature Component
const Feature = ({ icon: Icon, text, negative }) => (
    <li className="flex items-center">
        <Icon 
            className={`w-5 h-5 mr-3 flex-shrink-0 ${negative ? 'text-gray-500' : 'text-green-400'}`} 
            style={negative ? {} : { color: negative ? undefined : PRIMARY_ACCENT }} 
        />
        <span className={`font-medium ${negative ? 'line-through text-gray-500' : 'text-gray-200'}`}>{text}</span>
    </li>
);

// Pricing Card Component
const PricingCard = ({ plan, isSelected, onSelect }) => {
    const { id, name, price, description, features, tag } = plan;
    const priceDisplay = price === 0 ? 'Free' : `₹${price}`;
    
    // Dynamic classes based on selection
    const cardClasses = `
        relative p-8 rounded-2xl flex flex-col h-full transition-all duration-300 ease-in-out cursor-pointer
        shadow-2xl hover:shadow-xl
        border ${isSelected ? 'border-4' : 'border-gray-700'}
    `;
    
    // Use inline style for colors
    const cardStyle = {
        backgroundColor: isSelected ? SELECTED_CARD_BACKGROUND : CARD_BACKGROUND,
        borderColor: isSelected ? PRIMARY_ACCENT : CARD_BACKGROUND,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isSelected ? `0 0 20px -5px ${PRIMARY_ACCENT}` : '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    };

    const isFree = price === 0;

    return (
        <div 
            className={cardClasses}
            style={cardStyle}
            onClick={() => onSelect(id)}
        >
            {tag && isSelected && (
                <span 
                    className="absolute top-0 right-0 mt-0 -mr-0 rounded-bl-lg rounded-tr-2xl px-4 py-1 text-xs font-bold text-white uppercase tracking-wider shadow-lg"
                    style={{ backgroundColor: PRIMARY_ACCENT }}
                >
                    {tag}
                </span>
            )}

            <div className="mb-6 mt-2">
                <h2 className="text-2xl font-bold mb-2 text-white">
                    {name}
                </h2>
                <p className="text-gray-400 text-sm">{description}</p>
            </div>

            {/* Price Display */}
            <div className="mb-8 flex items-end">
                <span 
                    className="text-5xl font-extrabold" 
                    style={{ color: isFree ? '#fa4565' : PRIMARY_ACCENT }} // Green for Free, Accent for Paid
                >
                    {priceDisplay}
                </span>
                {!isFree && <span className="text-lg text-gray-400 ml-1 mb-1 font-medium">/mo</span>}
            </div>

            {/* Features List */}
            <ul className="space-y-4 flex-grow mb-10">
                {features.map((feature, index) => (
                    <Feature key={index} {...feature} />
                ))}
            </ul>

            {/* Selection Status */}
            <div className="mt-auto">
                {isSelected ? (
                    <button
                        className="w-full py-3 rounded-xl font-bold text-white shadow-lg cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: PRIMARY_ACCENT }}
                    >
                        Current Plan
                    </button>
                ) : (
                    <button
                        className="w-full py-3 rounded-xl font-bold text-gray-100 border border-gray-600 bg-transparent hover:bg-gray-700 transition"
                        onClick={(e) => { e.stopPropagation(); onSelect(id); }}
                    >
                        Select Plan
                    </button>
                )}
            </div>
        </div>
    );
};

// Main Application Component
export default function App() {
    const [selectedPlanId, setSelectedPlanId] = useState(plans[1].id); // Default to Premium Solo (₹49)
    const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

    // Simulating checkout/action
    const handleAction = () => {
        if (selectedPlan) {
            const priceText = selectedPlan.price === 0 ? 'Free' : `₹${selectedPlan.price}`;
            const actionText = selectedPlan.price === 0 ? 'Access granted!' : 'Processing payment...';
            
            console.log(`Action initiated for the ${selectedPlan.name} plan at ${priceText}.`);
            
            // Simple visual feedback simulation
            const button = document.getElementById('action-button');
            const originalText = selectedPlan.price === 0 
                ? 'Start Free Access' 
                : `Pay ₹${selectedPlan.price}`;
            
            if (button) {
                button.innerHTML = `<span class="flex items-center justify-center">
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg> ${actionText}
                </span>`;
                button.disabled = true;

                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    
                    // Display success message in the status bar
                    const status = document.getElementById('selection-status');
                    if(status) {
                        status.innerHTML = `<span style="color: #34d399;" class="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-check-circle w-5 h-5 mr-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> 
                            Action Complete: ${selectedPlan.name} (${priceText})
                        </span>`;
                    }

                }, 2000);
            }
        }
    };
    
    const actionButtonText = selectedPlan.price === 0 
        ? 'Start Free Access' 
        : `Pay ₹${selectedPlan.price}`;

    return (
        <div className="min-h-screen py-16 px-4 sm:px-10 flex flex-col items-center font-sans" style={{ backgroundColor: DARK_BACKGROUND }}>
            <div className="max-w-7xl w-full mx-auto">
                {/* Header Section */}
                <header className="text-center mb-16">
                    <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-white">
                        Choose the Plan That's Right for You
                    </h1>
                    <p className="text-xl text-gray-400 max-w-4xl mx-auto">
                        Affordable monthly plans for the Indian market, designed for every type of listener.
                    </p>
                    
                    {/* Dynamic Status Display */}
                    <div id="selection-status" className="mt-8 text-lg font-semibold flex items-center justify-center text-gray-300">
                        <span className="text-lg mr-2" style={{ color: PRIMARY_ACCENT }}>
                             {/* Lucide CheckCircle icon used here for clarity */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-check-circle w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                        </span>
                        Current Selection: <span className="ml-1 font-bold" style={{ color: PRIMARY_ACCENT }}>{selectedPlan.name}</span>
                        <span className="ml-2 text-gray-500">({selectedPlan.price === 0 ? 'Free' : `₹${selectedPlan.price}/mo`})</span>
                    </div>
                </header>

                {/* Pricing Cards Container */}
                <div id="pricing-grid" className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    {plans.map(plan => (
                        <PricingCard 
                            key={plan.id}
                            plan={plan}
                            isSelected={plan.id === selectedPlanId}
                            onSelect={setSelectedPlanId}
                        />
                    ))}
                </div>
                
                {/* Action Button */}
                <div className="mt-16 text-center">
                    <button 
                        id="action-button"
                        onClick={handleAction} 
                        className="text-white py-4 px-12 rounded-xl text-lg font-bold uppercase tracking-wider transition-all duration-300 transform hover:scale-105 active:scale-100 disabled:opacity-75 disabled:cursor-not-allowed"
                        style={{ 
                            backgroundColor: PRIMARY_ACCENT, 
                            boxShadow: `0 8px 20px -5px rgba(250, 69, 101, 0.4)` // Accent color shadow
                        }}
                    >
                        {actionButtonText}
                    </button>
                    <p className="mt-4 text-sm text-gray-500">
                        Cancel or downgrade anytime. No commitment required.
                    </p>
                </div>
            </div>
        </div>
    );
}