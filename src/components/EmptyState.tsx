'use client';
import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-24 aether-card border-dashed flex flex-col items-center">
      <div className="p-6 bg-secondary/50 rounded-full mb-6">
        {icon}
      </div>
      <p className="text-xl font-bold text-foreground mb-2">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-sm font-medium text-center">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
