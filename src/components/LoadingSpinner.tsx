'use client';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 animate-pulse">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      {message && (
        <p className="text-muted-foreground font-bold tracking-widest text-[10px]">{message}</p>
      )}
    </div>
  );
}
