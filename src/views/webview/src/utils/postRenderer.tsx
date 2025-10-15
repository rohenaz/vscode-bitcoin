import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Linkify from 'linkify-react';
import { formatDistanceToNow } from 'date-fns';
import type { ReactElement } from 'react';

/**
 * Format a timestamp to a human-readable relative time
 */
export function formatPostDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown date';

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(timestamp).toLocaleString();
  }
}

/**
 * Render markdown content with GitHub Flavored Markdown support
 */
export function renderMarkdown(content: string): ReactElement {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        // Customize link rendering
        a: ({ node, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--vscode-textLink-foreground)',
              textDecoration: 'underline'
            }}
          />
        ),
        // Customize code blocks
        code: ({ node, className, children, ...props }: any) => {
          const isInline = !className;
          return isInline ? (
            <code
              {...props}
              style={{
                backgroundColor: 'var(--vscode-textCodeBlock-background)',
                padding: '2px 4px',
                borderRadius: '3px',
                fontSize: '90%'
              }}
            >
              {children}
            </code>
          ) : (
            <code
              {...props}
              className={className}
              style={{
                display: 'block',
                backgroundColor: 'var(--vscode-textCodeBlock-background)',
                padding: '8px 12px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '90%'
              }}
            >
              {children}
            </code>
          );
        },
        // Customize blockquotes
        blockquote: ({ node, ...props }) => (
          <blockquote
            {...props}
            style={{
              borderLeft: '4px solid var(--vscode-textBlockQuote-border)',
              backgroundColor: 'var(--vscode-textBlockQuote-background)',
              margin: '8px 0',
              padding: '8px 12px',
              fontStyle: 'italic'
            }}
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Linkify plain text content - converts URLs to clickable links
 */
export function linkifyContent(content: string): ReactElement {
  return (
    <Linkify
      options={{
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'post-link',
        style: {
          color: 'var(--vscode-textLink-foreground)',
          textDecoration: 'underline'
        }
      }}
    >
      {content}
    </Linkify>
  );
}

/**
 * Detect if content is markdown (simple heuristic)
 */
export function isMarkdown(content: string): boolean {
  // Check for common markdown indicators
  const markdownIndicators = [
    /^#+\s/m,           // Headers
    /\*\*.*\*\*/,       // Bold
    /\*.*\*/,           // Italic
    /\[.*\]\(.*\)/,     // Links
    /^[-*+]\s/m,        // Lists
    /```/,              // Code blocks
    /^>/m,              // Blockquotes
  ];

  return markdownIndicators.some(regex => regex.test(content));
}

/**
 * Smart renderer - detects content type and renders appropriately
 */
export function renderPostContent(content: string): ReactElement {
  // If content looks like markdown, render as markdown
  if (isMarkdown(content)) {
    return renderMarkdown(content);
  }

  // Otherwise, render as plain text with linkify
  return linkifyContent(content);
}

/**
 * Truncate content to a maximum length with ellipsis
 */
export function truncateContent(content: string, maxLength: number = 280): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + '...';
}

/**
 * Extract first image URL from markdown content
 */
export function extractFirstImage(content: string): string | null {
  const imageRegex = /!\[.*?\]\((.*?)\)/;
  const match = content.match(imageRegex);
  return match ? match[1] : null;
}

/**
 * Remove markdown syntax from content (for previews)
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/^#+\s/gm, '')           // Headers
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
    .replace(/\*(.*?)\*/g, '$1')      // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Links
    .replace(/`([^`]+)`/g, '$1')      // Inline code
    .replace(/```[\s\S]*?```/g, '')   // Code blocks
    .replace(/^[-*+]\s/gm, '')        // Lists
    .replace(/^>\s/gm, '');           // Blockquotes
}
