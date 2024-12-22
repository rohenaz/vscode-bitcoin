import vsApi from './vsShim';
import type { TextDocument, Position, HoverProvider, ProviderResult, Hover } from './vsShim';
import { Script } from '@bsv/sdk';

// Opcode categories
type OpcodeCategory = 
  | 'Constants'
  | 'Flow Control'
  | 'Stack'
  | 'Data Manipulation'
  | 'Bitwise Logic'
  | 'Arithmetic'
  | 'Cryptographic'
  | 'Locktime'
  | 'Pseudo-words'
  | 'Reserved words';

// Bitcoin opcode information from the Bitcoin SV Wiki
const OPCODE_INFO: Record<string, { description: string, category: OpcodeCategory }> = {
  OP_0: { description: 'An empty array of bytes is pushed onto the stack.', category: 'Constants' },
  OP_FALSE: { description: 'An empty array of bytes is pushed onto the stack.', category: 'Constants' },
  OP_1: { description: 'The number 1 is pushed onto the stack.', category: 'Constants' },
  OP_TRUE: { description: 'The number 1 is pushed onto the stack.', category: 'Constants' },
  OP_2: { description: 'The number 2 is pushed onto the stack.', category: 'Constants' },
  OP_3: { description: 'The number 3 is pushed onto the stack.', category: 'Constants' },
  OP_4: { description: 'The number 4 is pushed onto the stack.', category: 'Constants' },
  OP_5: { description: 'The number 5 is pushed onto the stack.', category: 'Constants' },
  OP_6: { description: 'The number 6 is pushed onto the stack.', category: 'Constants' },
  OP_7: { description: 'The number 7 is pushed onto the stack.', category: 'Constants' },
  OP_8: { description: 'The number 8 is pushed onto the stack.', category: 'Constants' },
  OP_9: { description: 'The number 9 is pushed onto the stack.', category: 'Constants' },
  OP_10: { description: 'The number 10 is pushed onto the stack.', category: 'Constants' },
  OP_11: { description: 'The number 11 is pushed onto the stack.', category: 'Constants' },
  OP_12: { description: 'The number 12 is pushed onto the stack.', category: 'Constants' },
  OP_13: { description: 'The number 13 is pushed onto the stack.', category: 'Constants' },
  OP_14: { description: 'The number 14 is pushed onto the stack.', category: 'Constants' },
  OP_15: { description: 'The number 15 is pushed onto the stack.', category: 'Constants' },
  OP_16: { description: 'The number 16 is pushed onto the stack.', category: 'Constants' },
  OP_NOP: { description: 'Does nothing.', category: 'Flow Control' },
  OP_IF: { description: 'If the top stack value is TRUE, execute the following statements.', category: 'Flow Control' },
  OP_NOTIF: { description: 'If the top stack value is FALSE, execute the following statements.', category: 'Flow Control' },
  OP_ELSE: { description: 'Execute the statements following the previous OP_IF or OP_NOTIF if the condition was not met.', category: 'Flow Control' },
  OP_ENDIF: { description: 'Ends an if/else block.', category: 'Flow Control' },
  OP_VERIFY: { description: 'Marks transaction as invalid if top stack value is not true.', category: 'Flow Control' },
  OP_RETURN: { description: 'Ends script with top value on stack as final result.', category: 'Flow Control' },
  OP_TOALTSTACK: { description: 'Puts the input onto the top of the alt stack. Removes it from the main stack.', category: 'Stack' },
  OP_FROMALTSTACK: { description: 'Puts the input onto the top of the main stack. Removes it from the alt stack.', category: 'Stack' },
  OP_IFDUP: { description: 'Duplicates the top stack item if it is not 0.', category: 'Stack' },
  OP_DEPTH: { description: 'Pushes the size of the stack onto the stack.', category: 'Stack' },
  OP_DROP: { description: 'Removes the top stack item.', category: 'Stack' },
  OP_DUP: { description: 'Duplicates the top stack item.', category: 'Stack' },
  OP_NIP: { description: 'Removes the second-to-top stack item.', category: 'Stack' },
  OP_OVER: { description: 'Copies the second-to-top stack item to the top.', category: 'Stack' },
  OP_PICK: { description: 'Copies the nth item in the stack to the top.', category: 'Stack' },
  OP_ROLL: { description: 'Moves the nth item in the stack to the top.', category: 'Stack' },
  OP_ROT: { description: 'Rotates the top three stack items.', category: 'Stack' },
  OP_SWAP: { description: 'Swaps the top two stack items.', category: 'Stack' },
  OP_TUCK: { description: 'Copies the top item below the second item.', category: 'Stack' },
  OP_2DROP: { description: 'Removes the top two stack items.', category: 'Stack' },
  OP_2DUP: { description: 'Duplicates the top two stack items.', category: 'Stack' },
  OP_3DUP: { description: 'Duplicates the top three stack items.', category: 'Stack' },
  OP_2OVER: { description: 'Copies the pair of items two spaces back to the top.', category: 'Stack' },
  OP_2ROT: { description: 'Moves the fifth and sixth items to the top of the stack.', category: 'Stack' },
  OP_2SWAP: { description: 'Swaps the top two pairs of items.', category: 'Stack' },
  OP_CAT: { description: 'Concatenates two strings.', category: 'Data Manipulation' },
  OP_SPLIT: { description: 'Splits a string at the specified position.', category: 'Data Manipulation' },
  OP_NUM2BIN: { description: 'Converts numeric value a into byte sequence of length b.', category: 'Data Manipulation' },
  OP_BIN2NUM: { description: 'Converts byte sequence x into a numeric value.', category: 'Data Manipulation' },
  OP_SIZE: { description: 'Pushes the string length of the top element onto the stack.', category: 'Data Manipulation' },
  OP_INVERT: { description: 'Flips all bits in the top item.', category: 'Bitwise Logic' },
  OP_AND: { description: 'Boolean AND between each bit of the top two items.', category: 'Bitwise Logic' },
  OP_OR: { description: 'Boolean OR between each bit of the top two items.', category: 'Bitwise Logic' },
  OP_XOR: { description: 'Boolean XOR between each bit of the top two items.', category: 'Bitwise Logic' },
  OP_EQUAL: { description: 'Returns 1 if the top two items are exactly equal, 0 otherwise.', category: 'Bitwise Logic' },
  OP_EQUALVERIFY: { description: 'Same as OP_EQUAL, but runs OP_VERIFY afterward.', category: 'Bitwise Logic' },
  OP_1ADD: { description: 'Adds 1 to the top item.', category: 'Arithmetic' },
  OP_1SUB: { description: 'Subtracts 1 from the top item.', category: 'Arithmetic' },
  OP_2MUL: { description: 'Multiplies the top item by 2.', category: 'Arithmetic' },
  OP_2DIV: { description: 'Divides the top item by 2.', category: 'Arithmetic' },
  OP_NEGATE: { description: 'Flips the sign of the top item.', category: 'Arithmetic' },
  OP_ABS: { description: 'Replaces the top item with its absolute value.', category: 'Arithmetic' },
  OP_NOT: { description: 'If the top item is 0, replaces it with 1; otherwise replaces it with 0.', category: 'Arithmetic' },
  OP_0NOTEQUAL: { description: 'Returns 0 if the top item is 0; otherwise returns 1.', category: 'Arithmetic' },
  OP_ADD: { description: 'Adds the top two items.', category: 'Arithmetic' },
  OP_SUB: { description: 'Subtracts the top item from the second top item.', category: 'Arithmetic' },
  OP_MUL: { description: 'Multiplies the top two items.', category: 'Arithmetic' },
  OP_DIV: { description: 'Divides the second top item by the top item.', category: 'Arithmetic' },
  OP_MOD: { description: 'Returns the remainder after dividing the second top item by the top item.', category: 'Arithmetic' },
  OP_LSHIFT: { description: 'Shifts the second top item left by the number of bits specified by the top item.', category: 'Arithmetic' },
  OP_RSHIFT: { description: 'Shifts the second top item right by the number of bits specified by the top item.', category: 'Arithmetic' },
  OP_BOOLAND: { description: 'Returns 1 if both the top two items are non-zero; otherwise returns 0.', category: 'Arithmetic' },
  OP_BOOLOR: { description: 'Returns 1 if either of the top two items is non-zero; otherwise returns 0.', category: 'Arithmetic' },
  OP_NUMEQUAL: { description: 'Returns 1 if the top two items are equal; otherwise returns 0.', category: 'Arithmetic' },
  OP_NUMEQUALVERIFY: { description: 'Same as OP_NUMEQUAL, but runs OP_VERIFY afterward.', category: 'Arithmetic' },
  OP_NUMNOTEQUAL: { description: 'Returns 1 if the top two items are not equal; otherwise returns 0.', category: 'Arithmetic' },
  OP_LESSTHAN: { description: 'Returns 1 if the second top item is less than the top item; otherwise returns 0.', category: 'Arithmetic' },
  OP_GREATERTHAN: { description: 'Returns 1 if the second top item is greater than the top item; otherwise returns 0.', category: 'Arithmetic' },
  OP_LESSTHANOREQUAL: { description: 'Returns 1 if the second top item is less than or equal to the top item; otherwise returns 0.', category: 'Arithmetic' },
  OP_GREATERTHANOREQUAL: { description: 'Returns 1 if the second top item is greater than or equal to the top item; otherwise returns 0.', category: 'Arithmetic' },
  OP_MIN: { description: 'Returns the smaller of the top two items.', category: 'Arithmetic' },
  OP_MAX: { description: 'Returns the larger of the top two items.', category: 'Arithmetic' },
  OP_WITHIN: { description: 'Returns 1 if the third item is between the second and top items; otherwise returns 0.', category: 'Arithmetic' },
  OP_RIPEMD160: { description: 'Returns RIPEMD160 hash of top item.', category: 'Cryptographic' },
  OP_SHA1: { description: 'Returns SHA1 hash of top item.', category: 'Cryptographic' },
  OP_SHA256: { description: 'Returns SHA256 hash of top item.', category: 'Cryptographic' },
  OP_HASH160: { description: 'Returns RIPEMD160(SHA256()) hash of top item.', category: 'Cryptographic' },
  OP_HASH256: { description: 'Returns double SHA256 hash of top item.', category: 'Cryptographic' },
  OP_CODESEPARATOR: { description: 'Marks the beginning of signature-checked data.', category: 'Cryptographic' },
  OP_CHECKSIG: { description: 'Checks a signature against a public key.', category: 'Cryptographic' },
  OP_CHECKSIGVERIFY: { description: 'Same as OP_CHECKSIG, but runs OP_VERIFY afterward.', category: 'Cryptographic' },
  OP_CHECKMULTISIG: { description: 'Checks multiple signatures against multiple public keys.', category: 'Cryptographic' },
  OP_CHECKMULTISIGVERIFY: { description: 'Same as OP_CHECKMULTISIG, but runs OP_VERIFY afterward.', category: 'Cryptographic' },
  OP_NOP1: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP2: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP3: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP4: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP5: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP6: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP7: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP8: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP9: { description: 'Does nothing.', category: 'Reserved words' },
  OP_NOP10: { description: 'Does nothing.', category: 'Reserved words' }
} as const;

export class BitcoinHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): ProviderResult<Hover> {
    console.log('=== BitcoinHoverProvider.provideHover called ===');
    console.log('Document:', {
      uri: document.uri,
      languageId: document.languageId,
      lineCount: document.lineCount
    });
    console.log('Position:', {
      line: position.line,
      character: position.character
    });

    // Get the word at the current position
    const range = document.getWordRangeAtPosition(position);
    console.log('Word range:', range ? {
      start: { line: range.start.line, character: range.start.character },
      end: { line: range.end.line, character: range.end.character }
    } : 'undefined');
    
    if (!range) {
      console.log('No word range found');
      return undefined;
    }

    const word = document.getText(range);
    console.log('Word found:', word);

    // Get the full line for context
    const line = document.lineAt(position.line).text;
    console.log('Full line:', line);
    console.log('Line index:', position.line + 1);

    // Check for opcode
    if (word.startsWith('OP_')) {
      console.log('Opcode detected:', word);
      const info = OPCODE_INFO[word as keyof typeof OPCODE_INFO];
      console.log('Opcode info:', info);
      
      if (info) {
        const markdown = new vsApi.MarkdownString();
        markdown.appendMarkdown(`**${word}**\n\n`);
        markdown.appendMarkdown(`**Category**: ${info.category}\n\n`);
        
        // Try to get the opcode value from Script
        try {
          const opcodeValue = (Script as unknown as { [key: string]: number })[word];
          if (typeof opcodeValue === 'number') {
            markdown.appendMarkdown(`**Value**: ${opcodeValue} (0x${opcodeValue.toString(16).toUpperCase().padStart(2, '0')})\n\n`);
          }
        } catch (error) {
          console.error('Error getting opcode value:', error);
        }

        markdown.appendMarkdown(`**Description**: ${info.description}`);
        return new vsApi.Hover(markdown, range);
      }
    }

    // Check for Bitcoin address
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(word)) {
      console.log('Bitcoin address detected:', word);
      const markdown = new vsApi.MarkdownString();
      markdown.appendMarkdown(`[View address on WhatsOnChain](https://whatsonchain.com/address/${word})`);
      return new vsApi.Hover(markdown, range);
    }

    // Check for transaction ID
    if (/^[0-9a-fA-F]{64}$/.test(word)) {
      console.log('Transaction ID detected:', word);
      const markdown = new vsApi.MarkdownString();
      markdown.appendMarkdown(`[View transaction on WhatsOnChain](https://whatsonchain.com/tx/${word})`);
      return new vsApi.Hover(markdown, range);
    }

    console.log('No hover content generated for word:', word);
    console.log('=== End BitcoinHoverProvider.provideHover ===');
    return undefined;
  }
} 