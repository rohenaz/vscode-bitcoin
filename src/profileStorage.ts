import vsApi from './vsShim';
import type { BapIdentity } from './bapService';

/**
 * Draft profile data that can be edited locally before publishing
 */
export interface DraftProfile {
  idKey: string;
  identity: Partial<BapIdentity>;
  isDraft: boolean;
  lastModified: number;
  hasUnsavedChanges?: boolean;
}

/**
 * Service for managing draft profiles in VSCode globalState
 */
export class ProfileStorageService {
  private readonly storageKeyPrefix = 'bap-profile-draft-';

  constructor(private readonly context: any) {}

  /**
   * Get the storage key for a given identity key
   */
  private getStorageKey(idKey: string): string {
    return `${this.storageKeyPrefix}${idKey}`;
  }

  /**
   * Save a draft profile to storage
   */
  async saveDraft(idKey: string, identity: Partial<BapIdentity>): Promise<void> {
    const draft: DraftProfile = {
      idKey,
      identity,
      isDraft: true,
      lastModified: Date.now(),
      hasUnsavedChanges: true
    };

    await this.context.globalState.update(this.getStorageKey(idKey), draft);
  }

  /**
   * Get a draft profile from storage
   */
  async getDraft(idKey: string): Promise<DraftProfile | undefined> {
    return this.context.globalState.get<DraftProfile>(this.getStorageKey(idKey));
  }

  /**
   * Delete a draft profile (after publishing or discarding)
   */
  async deleteDraft(idKey: string): Promise<void> {
    await this.context.globalState.update(this.getStorageKey(idKey), undefined);
  }

  /**
   * Check if there's a draft for this identity
   */
  async hasDraft(idKey: string): Promise<boolean> {
    const draft = await this.getDraft(idKey);
    return draft !== undefined;
  }

  /**
   * Get all draft identity keys
   */
  async getAllDraftKeys(): Promise<string[]> {
    const keys = this.context.globalState.keys();
    return keys
      .filter((key: string) => key.startsWith(this.storageKeyPrefix))
      .map((key: string) => key.replace(this.storageKeyPrefix, ''));
  }

  /**
   * Mark a draft as having no unsaved changes (after publishing)
   */
  async markAsPublished(idKey: string): Promise<void> {
    const draft = await this.getDraft(idKey);
    if (draft) {
      draft.isDraft = false;
      draft.hasUnsavedChanges = false;
      await this.context.globalState.update(this.getStorageKey(idKey), draft);
    }
  }

  /**
   * Merge draft with published profile to detect changes
   */
  hasChanges(draft: Partial<BapIdentity>, published: BapIdentity): boolean {
    const fields: (keyof BapIdentity)[] = [
      'alternateName',
      'description',
      'image',
      'banner',
      'paymail',
      'url'
    ];

    return fields.some(field => {
      const draftValue = draft[field];
      const publishedValue = published[field];

      // Handle undefined/null/empty string as equivalent
      const normalizeDraft = draftValue || '';
      const normalizePublished = publishedValue || '';

      return normalizeDraft !== normalizePublished;
    });
  }
}
