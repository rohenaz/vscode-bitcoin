import type { BapProfile, BapIdentity } from './bapService';
import vsApi, { type WebviewPanel, type Disposable } from './vsShim';
import { BMAP_API_BASE_URL } from './constants';

interface EnrichedProfile extends BapProfile {
  hasDraft?: boolean;
  draftIdentity?: Partial<BapIdentity>;
  posts?: any[];
}

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

export class BapPanel {
  public static currentPanel: BapPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel) {
    this._panel = panel;

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static show(profile: EnrichedProfile) {
    const panel = vsApi.window.createWebviewPanel(
      'bapProfile',
      `BAP Profile: ${profile.identity.alternateName || profile.idKey}`,
      vsApi.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    const bapPanel = new BapPanel(panel);
    bapPanel.update(profile);
    return bapPanel;
  }

  private update(profile: EnrichedProfile) {
    this._panel.webview.html = this.getWebviewContent(profile);
  }

  private getWebviewContent(enrichedProfile: EnrichedProfile): string {
    const profile = enrichedProfile;
    // Merge draft identity with published identity (draft takes priority)
    const identity = { ...profile.identity, ...(profile.draftIdentity || {}) };
    const normalizedImageUrl = normalizeImageUrl(identity.image);
    const normalizedBannerUrl = normalizeImageUrl(identity.banner);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https://ordfs.network data:; connect-src ${BMAP_API_BASE_URL} https://whatsonchain.com;">
        <title>BAP Profile</title>
        <style>
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
            }
            body {
                color: var(--vscode-foreground);
                font-family: var(--vscode-font-family);
                font-size: 13px;
                line-height: 1.5;
            }
            .banner {
                width: 100%;
                height: 200px;
                object-fit: cover;
                background: linear-gradient(135deg, var(--vscode-editor-background) 0%, var(--vscode-input-background) 100%);
            }
            .profile-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 0 20px;
            }
            .profile-header {
                display: flex;
                align-items: flex-start;
                margin-top: -50px;
                margin-bottom: 20px;
                position: relative;
            }
            .profile-image {
                width: 120px;
                height: 120px;
                border-radius: 50%;
                border: 4px solid var(--vscode-editor-background);
                background: var(--vscode-editor-background);
                object-fit: cover;
            }
            .profile-info {
                margin-left: 20px;
                flex: 1;
                padding-top: 50px;
            }
            .profile-name {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            .draft-badge {
                display: inline-block;
                background: #fbbf24;
                color: #000;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                margin-left: 8px;
            }
            .profile-description {
                color: var(--vscode-descriptionForeground);
                margin-bottom: 12px;
                white-space: pre-wrap;
            }
            .profile-meta {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .profile-meta-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .section {
                background: var(--vscode-editor-background);
                padding: 16px;
                border-radius: 6px;
                margin: 16px 0;
            }
            .section-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid var(--vscode-widget-border);
            }
            .detail-grid {
                display: grid;
                grid-template-columns: 140px 1fr;
                gap: 8px;
                font-size: 12px;
            }
            .detail-label {
                font-weight: 600;
                color: var(--vscode-descriptionForeground);
            }
            .detail-value {
                word-break: break-all;
                font-family: var(--vscode-editor-font-family);
            }
            .post {
                background: var(--vscode-input-background);
                padding: 12px;
                border-radius: 4px;
                margin: 8px 0;
            }
            .post-content {
                margin-bottom: 8px;
                white-space: pre-wrap;
            }
            .post-meta {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }
            .loading {
                text-align: center;
                padding: 20px;
                color: var(--vscode-descriptionForeground);
            }
            .address-entry {
                background: var(--vscode-input-background);
                padding: 12px;
                margin: 8px 0;
                border-radius: 4px;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        ${normalizedBannerUrl ? `<img class="banner" src="${normalizedBannerUrl}" alt="Banner" />` : '<div class="banner"></div>'}

        <div class="profile-container">
            <div class="profile-header">
                ${normalizedImageUrl
                  ? `<img class="profile-image" src="${normalizedImageUrl}" alt="Profile" />`
                  : '<div class="profile-image"></div>'}
                <div class="profile-info">
                    <div class="profile-name">
                        ${identity.alternateName || 'Anonymous'}
                        ${profile.hasDraft ? '<span class="draft-badge">DRAFT</span>' : ''}
                    </div>
                    ${identity.description ? `<div class="profile-description">${identity.description}</div>` : ''}
                    <div class="profile-meta">
                        ${identity.paymail ? `<div class="profile-meta-item">📧 ${identity.paymail}</div>` : ''}
                        ${identity.url ? `<div class="profile-meta-item">🌐 <a href="${identity.url}" style="color: var(--vscode-textLink-foreground);">${identity.url}</a></div>` : ''}
                        ${identity.homeLocation ? `<div class="profile-meta-item">📍 ${identity.homeLocation.name}</div>` : ''}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Identity Details</div>
                <div class="detail-grid">
                    <div class="detail-label">ID Key:</div>
                    <div class="detail-value">${profile.idKey}</div>
                    <div class="detail-label">Current Address:</div>
                    <div class="detail-value">${profile.currentAddress}</div>
                    <div class="detail-label">Root Address:</div>
                    <div class="detail-value">${profile.rootAddress}</div>
                    <div class="detail-label">First Seen:</div>
                    <div class="detail-value">Block ${profile.firstSeen}</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Posts & Activity</div>
                <div id="posts-container">
                    <div class="loading">Loading posts...</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Address History</div>
                ${profile.addresses.map((addr) => `
                    <div class="address-entry">
                        <div class="detail-grid">
                            <div class="detail-label">Address:</div>
                            <div class="detail-value">${addr.address}</div>
                            <div class="detail-label">Transaction:</div>
                            <div class="detail-value">${addr.txId}</div>
                            <div class="detail-label">Block:</div>
                            <div class="detail-value">${addr.block}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <script>
            (async function() {
                const postsContainer = document.getElementById('posts-container');
                const currentAddress = '${profile.currentAddress}';

                // Check if we have an address to query
                if (!currentAddress || currentAddress === '') {
                    postsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">Profile not yet published on-chain</div>';
                    return;
                }

                try {
                    // Fetch posts from bmap-api filtered by signer address
                    const url = \`${BMAP_API_BASE_URL}/social/post/address/\${currentAddress}\`;
                    console.log('Fetching posts from:', url);

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    console.log('Response status:', response.status);

                    if (!response.ok) {
                        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                    }

                    const data = await response.json();
                    console.log('Response data:', data);

                    const posts = data.results || [];

                    if (posts.length === 0) {
                        postsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--vscode-descriptionForeground);">No posts yet</div>';
                        return;
                    }

                    // Render posts
                    let postsHtml = '';
                    posts.forEach(post => {
                        // Format timestamp with relative time
                        let timestampText = 'Unknown date';
                        if (post.timestamp) {
                            const date = new Date(post.timestamp);
                            const now = Date.now();
                            const diff = now - post.timestamp;
                            const seconds = Math.floor(diff / 1000);
                            const minutes = Math.floor(seconds / 60);
                            const hours = Math.floor(minutes / 60);
                            const days = Math.floor(hours / 24);

                            if (days > 7) {
                                timestampText = date.toLocaleDateString();
                            } else if (days > 0) {
                                timestampText = days === 1 ? '1 day ago' : \`\${days} days ago\`;
                            } else if (hours > 0) {
                                timestampText = hours === 1 ? '1 hour ago' : \`\${hours} hours ago\`;
                            } else if (minutes > 0) {
                                timestampText = minutes === 1 ? '1 minute ago' : \`\${minutes} minutes ago\`;
                            } else {
                                timestampText = 'just now';
                            }
                        } else if (post.blk?.t) {
                            timestampText = new Date(post.blk.t * 1000).toLocaleDateString();
                        }

                        const content = post.B?.[0]?.content || post.MAP?.[0]?.app || 'No content';
                        const txid = post._id || '';

                        // Process content for better display
                        let processedContent = escapeHtml(content);

                        // Auto-linkify URLs in content
                        processedContent = processedContent.replace(
                            /(https?:\\/\\/[^\\s<]+)/g,
                            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--vscode-textLink-foreground); text-decoration: underline;">$1</a>'
                        );

                        // Convert basic markdown-style formatting
                        processedContent = processedContent.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
                        processedContent = processedContent.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
                        processedContent = processedContent.replace(/\`([^\`]+)\`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">$1</code>');

                        postsHtml += \`
                            <div class="post">
                                <div class="post-content">\${processedContent}</div>
                                <div class="post-meta">
                                    <span>\${timestampText}</span>
                                    \${txid ? \` • <a href="https://whatsonchain.com/tx/\${txid}" target="_blank" rel="noopener noreferrer" style="color: var(--vscode-textLink-foreground);">\${txid.slice(0, 8)}...</a>\` : ''}
                                </div>
                            </div>
                        \`;
                    });

                    postsContainer.innerHTML = postsHtml;
                } catch (error) {
                    console.error('Error loading posts:', error);
                    postsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--vscode-errorForeground);">Failed to load posts: ' + error.message + '</div>';
                }

                function escapeHtml(text) {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
            })();
        </script>
    </body>
    </html>`;
  }

  public dispose() {
    BapPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
