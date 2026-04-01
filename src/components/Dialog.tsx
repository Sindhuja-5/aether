'use client';

import { X, AlertTriangle, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

export default function Dialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keyup', handleUp);
    return () => window.removeEventListener('keyup', handleUp);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: <AlertTriangle className="w-8 h-8 text-red-600" />,
      bg: 'bg-red-50',
      btn: 'bg-red-600 hover:bg-red-700 shadow-red-100',
    },
    warning: {
      icon: <AlertCircle className="w-8 h-8 text-amber-600" />,
      bg: 'bg-amber-50',
      btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
    },
    info: {
      icon: <Info className="w-8 h-8 text-blue-600" />,
      bg: 'bg-blue-50',
      btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-100',
    },
    success: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-600" />,
      bg: 'bg-green-50',
      btn: 'bg-green-600 hover:bg-green-700 shadow-green-100',
    }
  };

  const config = typeConfig[type];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Dialog Body */}
      <div 
        ref={dialogRef}
        className="relative bg-white w-full max-w-md rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-8 md:p-10">
          <div className="flex flex-col items-center text-center">
            <div className={`p-5 rounded-3xl ${config.bg} mb-6`}>
              {config.icon}
            </div>
            
            <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">
               {title}
            </h2>
            
            <p className="text-sm font-bold text-gray-500 leading-relaxed mb-10 max-w-[280px]">
               {description}
            </p>

            <div className="flex items-center space-x-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 px-6 rounded-2xl border border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition active:scale-95"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-3.5 px-6 rounded-2xl text-white font-black shadow-xl transition active:scale-95 ${config.btn}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
        
        {/* Close Icon (X) */}
        <button 
           onClick={onClose}
           className="absolute top-6 right-6 p-2 text-gray-300 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition"
        >
          <X className="w-5 h-5 focus:outline-none" />
        </button>
      </div>
    </div>
  );
}
