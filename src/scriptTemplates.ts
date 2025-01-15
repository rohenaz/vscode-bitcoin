import * as fs from 'node:fs';
import * as path from 'node:path';
import vsApi from './vsShim';

interface ScriptTemplate {
  name: string;
  // A regex pattern used to detect the script in ASM form
  pattern: string;
  // Example of possible callback config or instructions on how to parse it
  // For now, we just store a "description" and placeholders, but we can expand
  description: string;
  // If there's a capturing group in the pattern, we can store placeholders for them
  placeholders?: string[]; 
}

export class TemplateManager {
  private templates: ScriptTemplate[] = [];
  private templatesDir: string;

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir;
  }

  loadTemplates(): void {
    // Attempt to read all .json files in the templatesDir
    if (!fs.existsSync(this.templatesDir)) {
      return;
    }

    const files = fs.readdirSync(this.templatesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const fullPath = path.join(this.templatesDir, file);
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = JSON.parse(content) as ScriptTemplate;
          // Basic validation
          if (data.name && data.pattern && data.description) {
            this.templates.push(data);
          }
        } catch (error) {
          console.error('Failed to parse template file:', fullPath, error);
        }
      }
    }
  }

  getTemplates(): ScriptTemplate[] {
    return this.templates;
  }

  // Initialize templates directory with default P2PKH template if needed
  async initializeDefaultTemplates(): Promise<void> {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      
      // Write default P2PKH template
      const p2pkhTemplate: ScriptTemplate = {
        name: 'P2PKH',
        pattern: 'OP_DUP OP_HASH160 ([0-9A-Fa-f]{40}) OP_EQUALVERIFY OP_CHECKSIG',
        description: 'Pay to Public Key Hash - Standard Bitcoin payment script',
        placeholders: ['pubKeyHash']
      };

      const templatePath = path.join(this.templatesDir, 'p2pkh.json');
      await fs.promises.writeFile(
        templatePath,
        JSON.stringify(p2pkhTemplate, null, 2)
      );

      vsApi.window.showInformationMessage(
        'Created default script templates directory with P2PKH template'
      );
    }
  }
} 