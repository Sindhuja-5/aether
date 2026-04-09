'use client';

import { useState, useEffect, useRef } from 'react';
import { Tag, X, ChevronDown, Check } from 'lucide-react';
import { APP_TOPICS } from '@/lib/topics';
import { cn } from '@/lib/utils';

interface TagPickerProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
}

export default function TagPicker({ 
  selectedTags, 
  onChange, 
  label = "Select Topics", 
  placeholder = "Search and select topics..." 
}: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out topics already selected
  const filteredTopics = APP_TOPICS.filter(topic => 
    topic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTag = (topic: string) => {
    if (selectedTags.includes(topic)) {
      onChange(selectedTags.filter(t => t !== topic));
    } else {
      onChange([...selectedTags, topic]);
    }
  };

  const removeTag = (tagToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedTags.filter(t => t !== tagToRemove));
  };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="w-full space-y-3" ref={containerRef}>
      {label && (
        <div className="flex items-center space-x-2 text-gray-400 px-1">
          <Tag size={18} />
          <span className="text-xs font-bold leading-none">{label}</span>
        </div>
      )}

      {/* Input / Display Area */}
      <div 
        className={`w-full min-h-[60px] p-2 rounded-3xl border transition-all duration-300 flex flex-wrap gap-2 items-center cursor-text ${
          isOpen ? 'border-blue-200 bg-white ring-4 ring-blue-50' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
        }`}
        onClick={() => setIsOpen(true)}
      >
        {selectedTags.length > 0 ? (
          selectedTags.map(tag => (
            <span key={tag} className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-2xl text-[12px] font-bold shadow-lg shadow-blue-200 group transition-all animate-in fade-in zoom-in duration-200">
              <span>{tag}</span>
              <button 
                onClick={(e) => removeTag(tag, e)} 
                className="hover:bg-blue-700/50 rounded-full transition-colors p-0.5"
              >
                <X size={14} />
              </button>
            </span>
          ))
        ) : (
          !searchTerm && <span className="ml-3 text-gray-300 font-bold text-sm">{placeholder}</span>
        )}
        
        <input 
          type="text" 
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          className="flex-1 bg-transparent border-none outline-none font-bold text-gray-900 min-w-[120px] px-3 focus:ring-0"
          onFocus={() => setIsOpen(true)}
        />

        <div className="flex items-center px-3 text-gray-400">
           <ChevronDown size={18} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div className="absolute w-full max-w-[calc(100%-48px)] mt-2 bg-white rounded-[32px] border border-gray-100 shadow-2xl z-[100] max-h-[350px] overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300 p-2 custom-scrollbar">
          {filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 gap-1">
              {filteredTopics.map((topic) => {
                const isSelected = selectedTags.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => toggleTag(topic)}
                    className={cn(
                      "flex items-center justify-between w-full px-5 py-4 rounded-2xl text-left font-bold text-sm transition-[background-color,color]",
                      isSelected 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <span>{topic}</span>
                    {isSelected && <Check size={18} className="translate-x-0" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 font-bold text-sm">
               No matching topics found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
