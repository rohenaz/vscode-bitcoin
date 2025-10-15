import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription, ItemMedia, ItemActions } from './ui/item';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { UserCircle, Search, Plus, RefreshCw, Edit, Send, Loader2, MoreHorizontal } from 'lucide-react';
import { getVscode } from '../vscode';

/**
 * Normalize image URLs to ordfs.network format
 */
function normalizeImageUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Data URI - return as-is
  if (trimmedUrl.startsWith('data:')) {
    return trimmedUrl;
  }

  // Full HTTPS URL - return as-is
  if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')) {
    return trimmedUrl;
  }

  // b:// protocol
  if (trimmedUrl.startsWith('b://')) {
    const path = trimmedUrl.slice(4);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // ord:// protocol
  if (trimmedUrl.startsWith('ord://')) {
    const path = trimmedUrl.slice(6);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // Relative path starting with /
  if (trimmedUrl.startsWith('/')) {
    const path = trimmedUrl.slice(1);
    return path ? `https://ordfs.network/${path}` : null;
  }

  // Just a txid or txid_vout
  if (trimmedUrl.match(/^[a-f0-9]{64}(_\d+)?$/i)) {
    return `https://ordfs.network/${trimmedUrl}`;
  }

  // Fallback - prepend ordfs
  return `https://ordfs.network/${trimmedUrl}`;
}

const vscode = getVscode();

interface LocalIdentity {
  idKey: string;
  name: string;
  counter: number;
  rootAddress?: string;
  hasOnChainProfile: boolean;
  hasDraft?: boolean;
  hasUnsavedChanges?: boolean;
  isLoading?: boolean;
  displayName?: string;
  image?: string;
}

export function IdentityTab() {
  const [identities, setIdentities] = useState<LocalIdentity[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [newIdentityName, setNewIdentityName] = useState('');
  const [hasIdentityKey, setHasIdentityKey] = useState(true);
  const [isMasterKey, setIsMasterKey] = useState(true);

  useEffect(() => {
    // Request current identities on mount
    vscode.postMessage({ type: 'getIdentities' });

    // Listen for identity updates from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'identitiesUpdated':
          setIdentities(message.identities);
          setHasIdentityKey(message.hasIdentityKey ?? true);
          setIsMasterKey(message.isMasterKey ?? true);
          break;
        case 'identityUpdated':
          // Update a specific identity in the list
          setIdentities(prev => prev.map(id =>
            id.idKey === message.identity.idKey ? message.identity : id
          ));
          break;
        case 'discoveryComplete':
          setIsDiscovering(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDiscoverIdentities = () => {
    setIsDiscovering(true);
    vscode.postMessage({ type: 'discoverIdentities' });
  };

  const handleCreateIdentity = () => {
    if (!newIdentityName.trim()) return;
    vscode.postMessage({
      type: 'createIdentity',
      name: newIdentityName.trim()
    });
    setNewIdentityName('');
  };

  const handleViewProfile = (idKey: string) => {
    vscode.postMessage({ type: 'viewProfile', idKey });
  };

  const handleSetAsIdentityKey = () => {
    vscode.postMessage({ command: 'bitcoin.showKeyVault' });
  };

  const handleEditProfile = (identity: LocalIdentity) => {
    // Open edit panel in new window
    vscode.postMessage({
      type: 'getProfileForEdit',
      idKey: identity.idKey,
      displayName: identity.displayName || identity.name
    });
  };


  const handlePublishProfile = (idKey: string) => {
    vscode.postMessage({
      type: 'publishProfile',
      idKey
    });
  };

  return (
    <div className="identity-container">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4" />
          <span className="text-xs font-medium">BAP Identities</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiscoverIdentities}
          disabled={isDiscovering}
        >
          {isDiscovering ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* No Identity Key Warning */}
      {hasIdentityKey === false && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCircle className="h-12 w-12 text-destructive" />
            </EmptyMedia>
            <EmptyTitle>No Identity Key Set</EmptyTitle>
            <EmptyDescription>
              Designate a WIF key as your identity key to use BAP identities
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={handleSetAsIdentityKey}>
              Open Key Vault
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Member Key Info */}
      {hasIdentityKey && !isMasterKey && (
        <div className="p-3 mb-2 border-l-2 border-primary bg-primary/5">
          <div className="flex items-center gap-2 mb-1">
            <UserCircle className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">BAP Member Key</span>
          </div>
          <p className="text-xs text-muted-foreground">
            You can view and sign with this identity, but cannot create new identities
          </p>
        </div>
      )}

      {/* Main Content */}
      {hasIdentityKey && (
        <Accordion type="multiple" className="w-full">
          {/* Create Identity Section (Master Key Only) */}
          {isMasterKey && (
            <AccordionItem value="create">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3" />
                  Create Identity
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex gap-2 p-2">
                  <input
                    type="text"
                    value={newIdentityName}
                    onChange={(e) => setNewIdentityName(e.target.value)}
                    placeholder="Identity name..."
                    className="flex-1 h-7 px-2 text-xs bg-background border border-input rounded-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateIdentity()}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateIdentity}
                    disabled={!newIdentityName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Identities List Section */}
          <AccordionItem value="identities">
            <AccordionTrigger className="text-xs">
              <div className="flex items-center gap-2">
                <UserCircle className="h-3 w-3" />
                Identities
                <span className="ml-auto text-muted-foreground">
                  ({identities.length})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {identities.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UserCircle className="h-8 w-8 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">No Identities</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Create a new identity or discover existing ones
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup>
                  {identities.map((identity) => {
                    const normalizedImage = normalizeImageUrl(identity.image);
                    return (
                      <Item
                        key={identity.idKey}
                        size="sm"
                        className="group cursor-pointer"
                        onClick={() => !identity.isLoading && handleViewProfile(identity.idKey)}
                      >
                        <ItemMedia>
                          {identity.isLoading ? (
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                          ) : normalizedImage ? (
                            <img
                              src={normalizedImage}
                              alt={identity.displayName || identity.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <UserCircle className="h-8 w-8 text-primary" />
                          )}
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle className="flex items-center gap-2">
                            {identity.displayName || identity.name}
                            {identity.isLoading && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Loading...
                              </Badge>
                            )}
                            {identity.hasDraft && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-600/30">
                                Draft
                              </Badge>
                            )}
                            {identity.hasOnChainProfile && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                Published
                              </Badge>
                            )}
                            {identity.hasUnsavedChanges && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-500/10 text-orange-600 border-orange-600/30">
                                Unsaved
                              </Badge>
                            )}
                          </ItemTitle>
                          <ItemDescription className="font-mono">
                            {identity.idKey.slice(0, 20)}...
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={identity.isLoading}
                              >
                                <MoreHorizontal className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-40" align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onSelect={() => handleEditProfile(identity)}>
                                  <Edit className="h-3 w-3 mr-2" />
                                  Edit Profile
                                </DropdownMenuItem>
                                {identity.hasDraft && identity.hasUnsavedChanges && (
                                  <DropdownMenuItem onSelect={() => handlePublishProfile(identity.idKey)}>
                                    <Send className="h-3 w-3 mr-2" />
                                    Publish to Chain
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ItemActions>
                      </Item>
                    );
                  })}
                </ItemGroup>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
