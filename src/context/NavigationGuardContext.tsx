'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';

interface NavigationGuardContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  confirmNavigation: (targetUrl: string) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const router = useRouter();

  const confirmNavigation = (targetUrl: string) => {
    if (isDirty) {
      setPendingUrl(targetUrl);
      setShowDialog(true);
    } else {
      router.push(targetUrl);
    }
  };

  const handleConfirm = () => {
    setDirty(false);
    setShowDialog(false);
    if (pendingUrl) {
      router.push(pendingUrl);
      setPendingUrl(null);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingUrl(null);
  };

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setDirty, confirmNavigation }}>
      {children}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave this page?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancel}>Keep Editing</Button>
            <Button variant="destructive" onClick={handleConfirm}>Discard & Exit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within a NavigationGuardProvider');
  }
  return context;
}
