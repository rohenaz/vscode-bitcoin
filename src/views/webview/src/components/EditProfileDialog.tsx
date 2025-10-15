import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface BapIdentity {
  '@context'?: string;
  '@type'?: string;
  alternateName?: string;
  banner?: string;
  description?: string;
  homeLocation?: {
    '@type': string;
    name: string;
  };
  image?: string;
  paymail?: string;
  url?: string;
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idKey: string;
  identity: Partial<BapIdentity>;
  onSave: (identity: Partial<BapIdentity>) => void;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  idKey,
  identity,
  onSave
}: EditProfileDialogProps) {
  const [formData, setFormData] = useState<Partial<BapIdentity>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when dialog opens or identity changes
  useEffect(() => {
    if (open) {
      setFormData({
        alternateName: identity.alternateName || '',
        description: identity.description || '',
        paymail: identity.paymail || '',
        url: identity.url || '',
        image: identity.image || '',
        banner: identity.banner || '',
      });
    }
  }, [open, identity]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Remove empty fields
      const cleanedData = Object.fromEntries(
        Object.entries(formData).filter(([_, v]) => v && String(v).trim() !== '')
      );

      onSave(cleanedData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription className="text-xs font-mono">
            {idKey}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="alternateName" className="text-xs">Name</Label>
            <Input
              id="alternateName"
              value={formData.alternateName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, alternateName: e.target.value }))}
              placeholder="Your name or handle"
              className="text-xs"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Tell people about yourself..."
              rows={4}
              className="text-xs resize-none"
            />
          </div>

          {/* Paymail */}
          <div className="space-y-2">
            <Label htmlFor="paymail" className="text-xs">Paymail</Label>
            <Input
              id="paymail"
              type="email"
              value={formData.paymail || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, paymail: e.target.value }))}
              placeholder="name@example.com"
              className="text-xs font-mono"
            />
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-xs">Website</Label>
            <Input
              id="url"
              type="url"
              value={formData.url || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com"
              className="text-xs"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image" className="text-xs">Profile Image URL</Label>
            <Input
              id="image"
              value={formData.image || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
              placeholder="txid_vout or https://ordfs.network/..."
              className="text-xs font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Enter a Bitcoin file txid_vout or full URL
            </p>
          </div>

          {/* Banner URL */}
          <div className="space-y-2">
            <Label htmlFor="banner" className="text-xs">Banner Image URL</Label>
            <Input
              id="banner"
              value={formData.banner || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, banner: e.target.value }))}
              placeholder="txid_vout or https://ordfs.network/..."
              className="text-xs font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Enter a Bitcoin file txid_vout or full URL
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
