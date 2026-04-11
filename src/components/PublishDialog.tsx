'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingStatus: 'draft' | 'published' | null;
  onConfirm: (status: 'draft' | 'published') => void;
}

export function PublishDialog({ open, onOpenChange, pendingStatus, onConfirm }: PublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pendingStatus === 'published' ? 'Publish Story?' : 'Unpublish Story?'}</DialogTitle>
          <DialogDescription>
            {pendingStatus === 'published'
              ? 'This will make your story visible to the public. Ready to share?'
              : 'This will move your story back to drafts and hide it from the public.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={pendingStatus === 'published' ? 'default' : 'destructive'}
            onClick={() => pendingStatus && onConfirm(pendingStatus)}
          >
            {pendingStatus === 'published' ? 'Yes, Publish' : 'Yes, Unpublish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
