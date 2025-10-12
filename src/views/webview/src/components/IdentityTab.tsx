import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { UserCircle, Search, Plus, Eye, RefreshCw } from 'lucide-react';
import { getVscode } from '../vscode';

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
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">BAP Identities</h2>
          <p className="text-xs text-muted-foreground">
            Bitcoin Attestation Protocol on-chain identities
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDiscoverIdentities}
          disabled={isDiscovering}
        >
          {isDiscovering ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Discovering...
            </>
          ) : (
            <>
              <Search className="h-3 w-3 mr-1" />
              Discover
            </>
          )}
        </Button>
      </div>

      {/* No Identity Key Warning */}
      {hasIdentityKey === false && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-6 text-center">
            <UserCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p className="text-sm font-medium mb-2">No Identity Key Set</p>
            <p className="text-xs text-muted-foreground mb-3">
              You need to designate a WIF key as your identity key to use BAP identities
            </p>
            <Button size="sm" onClick={handleSetAsIdentityKey}>
              Open Key Vault
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Member Key Info (read-only) */}
      {hasIdentityKey && !isMasterKey && (
        <Card className="border-primary/50 bg-primary/10">
          <CardContent className="py-4 text-center">
            <UserCircle className="h-10 w-10 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium mb-1">BAP Member Key</p>
            <p className="text-xs text-muted-foreground">
              This is a member identity key. You can view and sign with this identity, but cannot create new identities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create New Identity (Master Key Only) */}
      {hasIdentityKey && isMasterKey && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Identity
            </CardTitle>
            <CardDescription className="text-xs">
              Create a new BAP identity from your master key
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
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
          </CardContent>
        </Card>
      )}

      {/* Identities List */}
      {identities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-2">No identities found</p>
            <p className="text-xs text-muted-foreground">
              Create a new identity or discover existing ones
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {identities.map((identity) => (
            <Card key={identity.idKey}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <UserCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {identity.name}
                      </span>
                      {identity.hasOnChainProfile && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          On-chain
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {identity.idKey}
                      </p>
                      {identity.rootAddress && (
                        <p className="text-xs text-muted-foreground">
                          Root: {identity.rootAddress.slice(0, 20)}...
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Counter: {identity.counter}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewProfile(identity.idKey)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected Profile Viewer */}
      {selectedProfile && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedProfile.identity.image && (
              <div className="flex justify-center mb-3">
                <img
                  src={selectedProfile.identity.image}
                  alt="Profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
            )}
            {selectedProfile.identity.alternateName && (
              <div>
                <span className="text-xs font-medium">Name:</span>
                <p className="text-xs text-muted-foreground">
                  {selectedProfile.identity.alternateName}
                </p>
              </div>
            )}
            {selectedProfile.identity.description && (
              <div>
                <span className="text-xs font-medium">Description:</span>
                <p className="text-xs text-muted-foreground">
                  {selectedProfile.identity.description}
                </p>
              </div>
            )}
            {selectedProfile.identity.paymail && (
              <div>
                <span className="text-xs font-medium">Paymail:</span>
                <p className="text-xs text-muted-foreground font-mono">
                  {selectedProfile.identity.paymail}
                </p>
              </div>
            )}
            {selectedProfile.identity.url && (
              <div>
                <span className="text-xs font-medium">URL:</span>
                <a
                  href={selectedProfile.identity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {selectedProfile.identity.url}
                </a>
              </div>
            )}
            <div>
              <span className="text-xs font-medium">Current Address:</span>
              <p className="text-xs text-muted-foreground font-mono break-all">
                {selectedProfile.currentAddress}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium">First Seen:</span>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedProfile.firstSeen * 1000).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
