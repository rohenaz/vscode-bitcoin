// src/types/html-extend.d.ts
import '@kitajs/html';  // Make sure we import the typed-html package

declare global {
  namespace JSX {
    interface HtmlTag {
      // Add custom attributes here:
      nonce?: string;
    }
  }
} 