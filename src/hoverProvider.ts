import { Utils } from '@bsv/sdk';
import vsApi from './vsShim';
import type { TextDocument, Position, HoverProvider, ProviderResult, Hover } from './vsShim';
import { Script } from '@bsv/sdk';
import type { TemplateManager } from './scriptTemplates';

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

interface OpcodeInfo {
  description: string;
  category: OpcodeCategory;
  alternateNames?: string[];
  hex: string;
  decimal: number;
  disabled?: boolean;
  input?: string;
  output?: string;
}

// Bitcoin opcode information from the Bitcoin SV Wiki
const OPCODE_INFO: Record<string, OpcodeInfo> = {
  OP_0: { 
    description: 'An empty array of bytes is pushed onto the stack.',
    category: 'Constants',
    alternateNames: ['OP_FALSE'],
    hex: '0x00',
    decimal: 0,
    input: 'Nothing',
    output: '(empty value)'
  },
  OP_FALSE: { 
    description: 'An empty array of bytes is pushed onto the stack.',
    category: 'Constants',
    alternateNames: ['OP_0'],
    hex: '0x00',
    decimal: 0,
    input: 'Nothing',
    output: '(empty value)'
  },
  OP_1: { description: 'The number 1 is pushed onto the stack.', category: 'Constants', alternateNames: ['OP_TRUE'], hex: '0x01', decimal: 1 },
  OP_TRUE: { description: 'The number 1 is pushed onto the stack.', category: 'Constants', alternateNames: ['OP_1'], hex: '0x01', decimal: 1 },
  OP_2: { description: 'The number 2 is pushed onto the stack.', category: 'Constants', hex: '0x02', decimal: 2 },
  OP_3: { description: 'The number 3 is pushed onto the stack.', category: 'Constants', hex: '0x03', decimal: 3 },
  OP_4: { description: 'The number 4 is pushed onto the stack.', category: 'Constants', hex: '0x04', decimal: 4 },
  OP_5: { description: 'The number 5 is pushed onto the stack.', category: 'Constants', hex: '0x05', decimal: 5 },
  OP_6: { description: 'The number 6 is pushed onto the stack.', category: 'Constants', hex: '0x06', decimal: 6 },
  OP_7: { description: 'The number 7 is pushed onto the stack.', category: 'Constants', hex: '0x07', decimal: 7 },
  OP_8: { description: 'The number 8 is pushed onto the stack.', category: 'Constants', hex: '0x08', decimal: 8 },
  OP_9: { description: 'The number 9 is pushed onto the stack.', category: 'Constants', hex: '0x09', decimal: 9 },
  OP_10: { description: 'The number 10 is pushed onto the stack.', category: 'Constants', hex: '0x0a', decimal: 10 },
  OP_11: { description: 'The number 11 is pushed onto the stack.', category: 'Constants', hex: '0x0b', decimal: 11 },
  OP_12: { description: 'The number 12 is pushed onto the stack.', category: 'Constants', hex: '0x0c', decimal: 12 },
  OP_13: { description: 'The number 13 is pushed onto the stack.', category: 'Constants', hex: '0x0d', decimal: 13 },
  OP_14: { description: 'The number 14 is pushed onto the stack.', category: 'Constants', hex: '0x0e', decimal: 14 },
  OP_15: { description: 'The number 15 is pushed onto the stack.', category: 'Constants', hex: '0x0f', decimal: 15 },
  OP_16: { description: 'The number 16 is pushed onto the stack.', category: 'Constants', hex: '0x10', decimal: 16 },
  OP_NOP: { description: 'Does nothing.', category: 'Flow Control', hex: '0x60', decimal: 96 },
  OP_IF: { description: 'If the top stack value is TRUE, execute the following statements.', category: 'Flow Control', hex: '0x61', decimal: 97 },
  OP_NOTIF: { description: 'If the top stack value is FALSE, execute the following statements.', category: 'Flow Control', hex: '0x62', decimal: 98 },
  OP_ELSE: { description: 'Execute the statements following the previous OP_IF or OP_NOTIF if the condition was not met.', category: 'Flow Control', hex: '0x63', decimal: 99 },
  OP_ENDIF: { description: 'Ends an if/else block.', category: 'Flow Control', hex: '0x64', decimal: 100 },
  OP_VERIFY: { description: 'Marks transaction as invalid if top stack value is not true.', category: 'Flow Control', hex: '0x65', decimal: 101 },
  OP_RETURN: { description: 'Ends script with top value on stack as final result.', category: 'Flow Control', hex: '0x6a', decimal: 106 },
  OP_TOALTSTACK: { description: 'Puts the input onto the top of the alt stack. Removes it from the main stack.', category: 'Stack', hex: '0x6b', decimal: 107 },
  OP_FROMALTSTACK: { description: 'Puts the input onto the top of the main stack. Removes it from the alt stack.', category: 'Stack', hex: '0x6c', decimal: 108 },
  OP_IFDUP: { description: 'Duplicates the top stack item if it is not 0.', category: 'Stack', hex: '0x73', decimal: 115 },
  OP_DEPTH: { description: 'Pushes the size of the stack onto the stack.', category: 'Stack', hex: '0x74', decimal: 116 },
  OP_DROP: { description: 'Removes the top stack item.', category: 'Stack', hex: '0x75', decimal: 117 },
  OP_DUP: { description: 'Duplicates the top stack item.', category: 'Stack', hex: '0x76', decimal: 118 },
  OP_NIP: { description: 'Removes the second-to-top stack item.', category: 'Stack', hex: '0x77', decimal: 119 },
  OP_OVER: { description: 'Copies the second-to-top stack item to the top.', category: 'Stack', hex: '0x78', decimal: 120 },
  OP_PICK: { description: 'Copies the nth item in the stack to the top.', category: 'Stack', hex: '0x79', decimal: 121 },
  OP_ROLL: { description: 'Moves the nth item in the stack to the top.', category: 'Stack', hex: '0x7a', decimal: 122 },
  OP_ROT: { description: 'Rotates the top three stack items.', category: 'Stack', hex: '0x7b', decimal: 123 },
  OP_SWAP: { description: 'Swaps the top two stack items.', category: 'Stack', hex: '0x7c', decimal: 124 },
  OP_TUCK: { description: 'Copies the top item below the second item.', category: 'Stack', hex: '0x7d', decimal: 125 },
  OP_2DROP: { description: 'Removes the top two stack items.', category: 'Stack', hex: '0x7e', decimal: 126 },
  OP_2DUP: { description: 'Duplicates the top two stack items.', category: 'Stack', hex: '0x7f', decimal: 127 },
  OP_3DUP: { description: 'Duplicates the top three stack items.', category: 'Stack', hex: '0x80', decimal: 128 },
  OP_2OVER: { description: 'Copies the pair of items two spaces back to the top.', category: 'Stack', hex: '0x81', decimal: 129 },
  OP_2ROT: { description: 'Moves the fifth and sixth items to the top of the stack.', category: 'Stack', hex: '0x82', decimal: 130 },
  OP_2SWAP: { description: 'Swaps the top two pairs of items.', category: 'Stack', hex: '0x83', decimal: 131 },
  OP_CAT: { description: 'Concatenates two strings.', category: 'Data Manipulation', hex: '0x90', decimal: 144 },
  OP_SPLIT: { description: 'Splits a string at the specified position.', category: 'Data Manipulation', hex: '0x91', decimal: 145 },
  OP_NUM2BIN: { description: 'Converts numeric value a into byte sequence of length b.', category: 'Data Manipulation', hex: '0x92', decimal: 146 },
  OP_BIN2NUM: { description: 'Converts byte sequence x into a numeric value.', category: 'Data Manipulation', hex: '0x93', decimal: 147 },
  OP_SIZE: { description: 'Pushes the string length of the top element onto the stack.', category: 'Data Manipulation', hex: '0x94', decimal: 148 },
  OP_INVERT: { description: 'Flips all bits in the top item.', category: 'Bitwise Logic', hex: '0xa0', decimal: 160 },
  OP_AND: { description: 'Boolean AND between each bit of the top two items.', category: 'Bitwise Logic', hex: '0xa1', decimal: 161 },
  OP_OR: { description: 'Boolean OR between each bit of the top two items.', category: 'Bitwise Logic', hex: '0xa2', decimal: 162 },
  OP_XOR: { description: 'Boolean XOR between each bit of the top two items.', category: 'Bitwise Logic', hex: '0xa3', decimal: 163 },
  OP_EQUAL: { description: 'Returns 1 if the top two items are exactly equal, 0 otherwise.', category: 'Bitwise Logic', hex: '0xa4', decimal: 164 },
  OP_EQUALVERIFY: { description: 'Same as OP_EQUAL, but runs OP_VERIFY afterward.', category: 'Bitwise Logic', hex: '0xa5', decimal: 165 },
  OP_1ADD: { description: 'Adds 1 to the top item.', category: 'Arithmetic', hex: '0xa6', decimal: 166 },
  OP_1SUB: { description: 'Subtracts 1 from the top item.', category: 'Arithmetic', hex: '0xa7', decimal: 167 },
  OP_2MUL: { description: 'The input is multiplied by 2. (This opcode is scheduled to be re-enabled in the Chronicle update)', category: 'Arithmetic', hex: '0x8d', decimal: 141, disabled: true, input: 'in', output: 'out' },
  OP_2DIV: { description: 'The input is divided by 2. (This opcode is scheduled to be re-enabled in the Chronicle update)', category: 'Arithmetic', hex: '0x8e', decimal: 142, disabled: true, input: 'in', output: 'out' },
  OP_NEGATE: { description: 'Flips the sign of the top item.', category: 'Arithmetic', hex: '0xa7', decimal: 167 },
  OP_ABS: { description: 'Replaces the top item with its absolute value.', category: 'Arithmetic', hex: '0xa8', decimal: 168 },
  OP_NOT: { description: 'If the top item is 0, replaces it with 1; otherwise replaces it with 0.', category: 'Arithmetic', hex: '0xa9', decimal: 169 },
  OP_0NOTEQUAL: { description: 'Returns 0 if the top item is 0; otherwise returns 1.', category: 'Arithmetic', hex: '0xaa', decimal: 170 },
  OP_ADD: { description: 'Adds the top two items.', category: 'Arithmetic', hex: '0xaa', decimal: 170 },
  OP_SUB: { description: 'Subtracts the top item from the second top item.', category: 'Arithmetic', hex: '0xab', decimal: 171 },
  OP_MUL: { description: 'Multiplies the top two items.', category: 'Arithmetic', hex: '0xac', decimal: 172 },
  OP_DIV: { description: 'Divides the second top item by the top item.', category: 'Arithmetic', hex: '0xad', decimal: 173 },
  OP_MOD: { description: 'Returns the remainder after dividing the second top item by the top item.', category: 'Arithmetic', hex: '0xae', decimal: 174 },
  OP_LSHIFT: { description: 'Shifts the second top item left by the number of bits specified by the top item.', category: 'Arithmetic', hex: '0xaf', decimal: 175 },
  OP_RSHIFT: { description: 'Shifts the second top item right by the number of bits specified by the top item.', category: 'Arithmetic', hex: '0xb0', decimal: 176 },
  OP_BOOLAND: { description: 'Returns 1 if both the top two items are non-zero; otherwise returns 0.', category: 'Arithmetic', hex: '0xb1', decimal: 177 },
  OP_BOOLOR: { description: 'Returns 1 if either of the top two items is non-zero; otherwise returns 0.', category: 'Arithmetic', hex: '0xb2', decimal: 178 },
  OP_NUMEQUAL: { description: 'Returns 1 if the top two items are equal; otherwise returns 0.', category: 'Arithmetic', hex: '0xb3', decimal: 179 },
  OP_NUMEQUALVERIFY: { description: 'Same as OP_NUMEQUAL, but runs OP_VERIFY afterward.', category: 'Arithmetic', hex: '0xb4', decimal: 180 },
  OP_NUMNOTEQUAL: { description: 'Returns 1 if the top two items are not equal; otherwise returns 0.', category: 'Arithmetic', hex: '0xb5', decimal: 181 },
  OP_LESSTHAN: { description: 'Returns 1 if the second top item is less than the top item; otherwise returns 0.', category: 'Arithmetic', hex: '0xb6', decimal: 182 },
  OP_GREATERTHAN: { description: 'Returns 1 if the second top item is greater than the top item; otherwise returns 0.', category: 'Arithmetic', hex: '0xb7', decimal: 183 },
  OP_LESSTHANOREQUAL: { description: 'Returns 1 if the second top item is less than or equal to the top item; otherwise returns 0.', category: 'Arithmetic', hex: '0xb8', decimal: 184 },
  OP_GREATERTHANOREQUAL: { description: 'Returns 1 if the second top item is greater than or equal to the top item; otherwise returns 0.', category: 'Arithmetic', hex: '0xb9', decimal: 185 },
  OP_MIN: { description: 'Returns the smaller of the top two items.', category: 'Arithmetic', hex: '0xba', decimal: 186 },
  OP_MAX: { description: 'Returns the larger of the top two items.', category: 'Arithmetic', hex: '0xbb', decimal: 187 },
  OP_WITHIN: { description: 'Returns 1 if the third item is between the second and top items; otherwise returns 0.', category: 'Arithmetic', hex: '0xbc', decimal: 188 },
  OP_RIPEMD160: { description: 'Returns RIPEMD160 hash of top item.', category: 'Cryptographic', hex: '0xa1', decimal: 161 },
  OP_SHA1: { description: 'Returns SHA1 hash of top item.', category: 'Cryptographic', hex: '0xa2', decimal: 162 },
  OP_SHA256: { description: 'Returns SHA256 hash of top item.', category: 'Cryptographic', hex: '0xa3', decimal: 163 },
  OP_HASH160: { description: 'Returns RIPEMD160(SHA256()) hash of top item.', category: 'Cryptographic', hex: '0xa4', decimal: 164 },
  OP_HASH256: { description: 'Returns double SHA256 hash of top item.', category: 'Cryptographic', hex: '0xa5', decimal: 165 },
  OP_CODESEPARATOR: { description: 'Marks the beginning of signature-checked data.', category: 'Cryptographic', hex: '0xa6', decimal: 166 },
  OP_CHECKSIG: { description: 'Checks a signature against a public key.', category: 'Cryptographic', hex: '0xac', decimal: 172 },
  OP_CHECKSIGVERIFY: { description: 'Same as OP_CHECKSIG, but runs OP_VERIFY afterward.', category: 'Cryptographic', hex: '0xad', decimal: 173 },
  OP_CHECKMULTISIG: { description: 'Checks multiple signatures against multiple public keys.', category: 'Cryptographic', hex: '0xae', decimal: 174 },
  OP_CHECKMULTISIGVERIFY: { description: 'Same as OP_CHECKMULTISIG, but runs OP_VERIFY afterward.', category: 'Cryptographic', hex: '0xaf', decimal: 175 },
  OP_NOP1: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP2: {
    description: 'NO OPERATION. Previously OP_CHECKLOCKTIMEVERIFY: Mark transaction as invalid if the top stack item is greater than the transaction\'s nLockTime field, otherwise script evaluation continues as though an OP_NOP was executed.',
    category: 'Reserved words',
    hex: '0xb1',
    decimal: 177,
    alternateNames: ['OP_CHECKLOCKTIMEVERIFY'],
    input: 'Nothing (Previously: x)',
    output: 'Nothing (Previously: x or fail)'
  },
  OP_NOP3: {
    description: 'NO OPERATION. Previously OP_CHECKSEQUENCEVERIFY: Mark transaction as invalid if the relative lock time of the input is not equal to or longer than the value of the top stack item.',
    category: 'Reserved words',
    hex: '0xb2',
    decimal: 178,
    alternateNames: ['OP_CHECKSEQUENCEVERIFY'],
    input: 'Nothing (Previously: x)',
    output: 'Nothing (Previously: x or fail)'
  },
  OP_NOP4: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP5: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP6: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP7: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP8: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP9: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_NOP10: { description: 'Does nothing. (Reserved for future soft-fork upgrades)', category: 'Reserved words', hex: '0x00', decimal: 0 },
  OP_VER: {
    description: 'Puts the version of the protocol under which this transaction will be evaluated onto the stack.',
    category: 'Flow Control',
    hex: '0x62',
    decimal: 98,
    disabled: true,
    input: 'Nothing',
    output: 'Protocol version'
  },
  OP_VERIF: {
    description: 'DISABLED',
    category: 'Flow Control',
    hex: '0x65',
    decimal: 101,
    disabled: true,
    input: 'DISABLED',
    output: 'DISABLED'
  },
  OP_VERNOTIF: {
    description: 'DISABLED',
    category: 'Flow Control',
    hex: '0x66',
    decimal: 102,
    disabled: true,
    input: 'DISABLED',
    output: 'DISABLED'
  },
  OP_RESERVED: {
    description: 'Transaction is invalid unless occurring in an unexecuted OP_IF branch',
    category: 'Reserved words',
    hex: '0x50',
    decimal: 80
  },
  OP_RESERVED1: {
    description: 'Transaction is invalid unless occurring in an unexecuted OP_IF branch',
    category: 'Reserved words',
    hex: '0x89',
    decimal: 137
  },
  OP_RESERVED2: {
    description: 'Transaction is invalid unless occurring in an unexecuted OP_IF branch',
    category: 'Reserved words',
    hex: '0x8a',
    decimal: 138
  },
  OP_PUBKEYHASH: {
    description: 'Represents a public key hashed with OP_HASH160.',
    category: 'Pseudo-words',
    hex: '0xfd',
    decimal: 253
  },
  OP_PUBKEY: {
    description: 'Represents a public key compatible with OP_CHECKSIG.',
    category: 'Pseudo-words',
    hex: '0xfe',
    decimal: 254
  },
  OP_INVALIDOPCODE: {
    description: 'Matches any opcode that is not yet assigned.',
    category: 'Pseudo-words',
    hex: '0xff',
    decimal: 255
  },
  OP_PUSHDATA1: {
    description: 'The next byte contains the number of bytes to be pushed onto the stack.',
    category: 'Constants',
    hex: '0x4c',
    decimal: 76,
    input: '(special)',
    output: 'data'
  },
  OP_PUSHDATA2: {
    description: 'The next two bytes contain the number of bytes to be pushed onto the stack in little endian order.',
    category: 'Constants',
    hex: '0x4d',
    decimal: 77,
    input: '(special)',
    output: 'data'
  },
  OP_PUSHDATA4: {
    description: 'The next four bytes contain the number of bytes to be pushed onto the stack in little endian order.',
    category: 'Constants',
    hex: '0x4e',
    decimal: 78,
    input: '(special)',
    output: 'data'
  },
  OP_1NEGATE: {
    description: 'The number -1 is pushed onto the stack.',
    category: 'Constants',
    hex: '0x4f',
    decimal: 79,
    input: 'Nothing',
    output: '-1'
  }
} as const;

export class BitcoinHoverProvider implements HoverProvider {
  private templateManager: TemplateManager;

  constructor(templateManager: TemplateManager) {
    this.templateManager = templateManager;
  }

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

    const line = document.lineAt(position.line).text;
    console.log('Full line:', line);
    console.log('Line index:', position.line + 1);

    // Check for script templates
    for (const template of this.templateManager.getTemplates()) {
      const regex = new RegExp(template.pattern);
      const match = regex.exec(line);
      if (match) {
        console.log('Matched template:', template.name);
        const markdown = new vsApi.MarkdownString();
        markdown.appendMarkdown(`**${template.name}**\n\n`);
        markdown.appendMarkdown(`${template.description}\n\n`);

        // Handle placeholders if they exist
        if (template.placeholders && match.length > 1) {
          for (let i = 0; i < template.placeholders.length; i++) {
            const value = match[i + 1];
            markdown.appendMarkdown(`**${template.placeholders[i]}**: \`${value}\`\n\n`);

            // Special handling for P2PKH template
            if (template.name === 'P2PKH' && template.placeholders[i] === 'pubKeyHash') {
              try {
                const pubKeyHashBytes = Utils.toArray(value, 'hex');
                const address = Utils.toBase58Check(pubKeyHashBytes, [0x00]);
                markdown.appendMarkdown(`**Address**: \`${address}\`\n\n`);
              } catch (error) {
                console.error('Error converting pubKeyHash to address:', error);
              }
            }
          }
        }

        // Return hover for the entire matched line
        const entireLineRange = document.lineAt(position.line).range;
        return new vsApi.Hover(markdown, entireLineRange);
      }
    }

    // Check for opcode
    if (word.startsWith('OP_')) {
      console.log('Opcode detected:', word);
      const info = OPCODE_INFO[word as keyof typeof OPCODE_INFO];
      console.log('Opcode info:', info);
      
      if (info) {
        const markdown = new vsApi.MarkdownString();
        
        // Title with alternate names and disabled status
        markdown.appendMarkdown(`# ${word}`);
        if (info.alternateNames?.length) {
          markdown.appendMarkdown(` *(${info.alternateNames.join(', ')})*`);
        }
        if (info.disabled) {
          markdown.appendMarkdown(' **[DISABLED]**');
        }
        markdown.appendMarkdown('\n\n');
        
        // Values in code block
        markdown.appendMarkdown('```\n');
        markdown.appendMarkdown(`Decimal: ${info.decimal}\n`);
        markdown.appendMarkdown(`Hex:     ${info.hex}\n`);
        if (info.input || info.output) {
          markdown.appendMarkdown(`Input:   ${info.input || 'None'}\n`);
          markdown.appendMarkdown(`Output:  ${info.output || 'None'}\n`);
        }
        markdown.appendMarkdown('```\n\n');

        // Category and description
        markdown.appendMarkdown(`**Category**: ${info.category}\n\n`);
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