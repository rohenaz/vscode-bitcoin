import type { DocumentSemanticTokensProvider, TextDocument, SemanticTokens } from 'vscode';
import vsApi from './vsShim';

export class BitcoinSemanticTokensProvider implements DocumentSemanticTokensProvider {
  private tokenTypes = ['opcode'];
  private tokenModifiers: string[] = [];
  public legend = new vsApi.SemanticTokensLegend(this.tokenTypes, this.tokenModifiers);

  constructor() {
    console.log('=== BitcoinSemanticTokensProvider constructed ===');
    console.log('Token types:', this.tokenTypes);
    console.log('Token modifiers:', this.tokenModifiers);
    console.log('Legend:', this.legend);
  }

  async provideDocumentSemanticTokens(document: TextDocument): Promise<SemanticTokens> {
    console.log('=== BitcoinSemanticTokensProvider.provideDocumentSemanticTokens called ===');
    console.log('Document:', {
      uri: document.uri.toString(),
      languageId: document.languageId,
      lineCount: document.lineCount,
      version: document.version
    });

    const builder = new vsApi.SemanticTokensBuilder(this.legend);
    let tokensFound = 0;

    try {
      // Scan each line for opcodes
      for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex).text;
        console.log(`Scanning line ${lineIndex + 1}:`, line);
        
        const opcodeRegex = /\bOP_[A-Z0-9_]+\b/g;
        let match: RegExpExecArray | null = null;
        
        do {
          match = opcodeRegex.exec(line);
          if (match === null) break;
          
          const startChar = match.index;
          const length = match[0].length;
          console.log(`Found opcode "${match[0]}" at line ${lineIndex + 1}, char ${startChar}, length ${length}`);
          
          builder.push(lineIndex, startChar, length, 0); // 0 is the index of 'opcode' in tokenTypes
          tokensFound++;
        } while (match !== null);
      }

      console.log(`Total opcodes found: ${tokensFound}`);
      const result = builder.build();
      console.log('Built semantic tokens:', result);
      console.log('=== End BitcoinSemanticTokensProvider.provideDocumentSemanticTokens ===');

      return result;
    } catch (error) {
      console.error('Error in provideDocumentSemanticTokens:', error);
      throw error;
    }
  }
} 