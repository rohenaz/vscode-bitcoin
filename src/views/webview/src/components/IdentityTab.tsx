import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './ui/empty';
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription, ItemMedia, ItemActions } from './ui/item';
import { UserCircle, Search, Plus, Eye, RefreshCw } from 'lucide-react';
import { getVscode } from '../vscode';
import { normalizeImageUrl } from '../utils/imageUtils';

const vscode = getVscode();

interface LocalIdentity {
  idKey: string;
  name: string;
  counter: number;
  rootAddress?: string;
  hasOnChainProfile: boolean;
}

interface BapIdentity {
  '@context': string;
  '@type': string;
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

interface BapProfile {
  idKey: string;
  firstSeen: number;
  rootAddress: string;
  currentAddress: string;
  identity: BapIdentity;
}

export function IdentityTab() {
  const [identities, setIdentities] = useState<LocalIdentity[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<BapProfile | null>(null);
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
        case 'profileLoaded':
          setSelectedProfile(message.profile);
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
                  {identities.map((identity) => (
                    <Item key={identity.idKey} size="sm" className="group">
                      <ItemMedia>
                        <UserCircle className="h-8 w-8 text-primary" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="flex items-center gap-2">
                          {identity.name}
                          {identity.hasOnChainProfile && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              On-chain
                            </Badge>
                          )}
                        </ItemTitle>
                        <ItemDescription className="font-mono">
                          {identity.idKey.slice(0, 20)}...
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleViewProfile(identity.idKey)}
                          title="View profile"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Profile Details Section */}
          {selectedProfile && (
            <AccordionItem value="profile">
              <AccordionTrigger className="text-xs">
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  Profile Details
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 p-2">
                  {/* Avatar */}
                  <div className="flex justify-center">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={normalizeImageUrl(selectedProfile.identity.image) || undefined}
                        alt={selectedProfile.identity.alternateName || 'Profile'}
                      />
                      <AvatarFallback>
                        <UserCircle className="h-10 w-10" />
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Profile Fields */}
                  {selectedProfile.identity.alternateName && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Name</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedProfile.identity.alternateName}
                      </div>
                    </div>
                  )}

                  {selectedProfile.identity.description && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Description</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedProfile.identity.description}
                      </div>
                    </div>
                  )}

                  {selectedProfile.identity.paymail && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Paymail</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {selectedProfile.identity.paymail}
                      </div>
                    </div>
                  )}

                  {selectedProfile.identity.url && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Website</div>
                      <a
                        href={selectedProfile.identity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {selectedProfile.identity.url}
                      </a>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium mb-0.5">Identity Key</div>
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {selectedProfile.idKey}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-0.5">Root Address</div>
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {selectedProfile.rootAddress}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-0.5">Current Address</div>
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {selectedProfile.currentAddress}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium mb-0.5">First Seen</div>
                    <div className="text-xs text-muted-foreground">
                      Block {selectedProfile.firstSeen}
                    </div>
                  </div>

                  {selectedProfile.identity.image && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Image URL</div>
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {selectedProfile.identity.image}
                      </div>
                    </div>
                  )}

                  {selectedProfile.identity.banner && (
                    <div>
                      <div className="text-xs font-medium mb-0.5">Banner URL</div>
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {selectedProfile.identity.banner}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}
    </div>
  );
}
