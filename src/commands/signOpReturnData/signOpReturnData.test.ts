import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { PrivateKey, Utils } from '@bsv/sdk';
import { MemberID } from 'bsv-bap';
import type { IdentityAttributes } from 'bsv-bap';
import vscode from '@test/setup';
import type { KeyVault, KeyEntry } from '../../keyVault';
import type { OutputManager } from '../../output';
import { signOpReturnData } from '.';

interface SignatureResponse {
  data: number[][];
  type: 'signatures';
  name: string;
}

// Mock MemberID
const mockSignMessage = mock<(data: number[][] | Buffer) => number[][]>(() => [
  Utils.toArray('mock_address'),
  Utils.toArray('mock_signature')
]);

const mockMemberID = {
  signMessage: mockSignMessage,
  signOpReturnWithAIP: mockSignMessage,
  key: PrivateKey.fromRandom(),
  identityAttributes: {} as IdentityAttributes,
  address: '',
  idName: '',
  description: '',
  name: '',
  toJSON: () => ({}),
  toImport: () => ({}),
  getPublicKey: () => '',
  import: () => ({}),
  export: () => ({}),
  parseStringUrns: () => ({})
} as unknown as MemberID;

const mockFromBackup = mock(() => mockMemberID);
MemberID.fromBackup = mockFromBackup;

const mockOutput = {
  handleOutput: mock(() => Promise.resolve()),
} as unknown as OutputManager;

type KeyEntryInput = Omit<KeyEntry, 'id' | 'timestamp'>;
const storeKeyMock = mock<(entry: KeyEntryInput) => Promise<string>>(() => Promise.resolve('test-id'));
const isAutoStoreEnabledMock = mock<() => boolean>(() => true);
const checkUnlockMock = mock<() => Promise<void>>(() => Promise.resolve());
const getAllKeysMock = mock<() => Promise<KeyEntry[]>>(() => Promise.resolve([]));
const getKeyMock = mock<(id: string) => Promise<KeyEntry | undefined>>(() => Promise.resolve(undefined));
const getIdentityKeyMock = mock<() => Promise<KeyEntry | undefined>>(() => Promise.resolve(undefined));

const mockKeyVault = {
  storeKey: storeKeyMock,
  isAutoStoreEnabled: isAutoStoreEnabledMock,
  isUnlocked: true,
  checkUnlock: checkUnlockMock,
  getAllKeys: getAllKeysMock,
  getKey: getKeyMock,
  getIdentityKey: getIdentityKeyMock,
} as unknown as KeyVault;

describe('signOpReturnData', () => {
  const originalWindow = vscode.window;
  const defaultPrivateKey = PrivateKey.fromRandom();
  const defaultIdentityKey: KeyEntry = {
    id: 'test-id',
    type: 'identity',
    value: defaultPrivateKey.toWif(),
    label: 'Identity Key',
    timestamp: Date.now(),
    isIdentityKey: true,
  };

  beforeEach(() => {
    vscode.window = originalWindow;
    getAllKeysMock.mockClear();
    getKeyMock.mockClear();
    getIdentityKeyMock.mockClear();
    mockSignMessage.mockClear();
    mockFromBackup.mockClear();
  });

  test('handles no data provided', async () => {
    expect(signOpReturnData(mockKeyVault))
      .rejects.toThrow('No data provided');
  });

  test('handles no identity key', async () => {
    getIdentityKeyMock.mockResolvedValue(undefined);

    const testData: number[][] = [Utils.toArray('test')];
    expect(signOpReturnData(mockKeyVault, { data: testData }))
      .rejects.toThrow('No identity key set');
  });

  test('signs data with identity key', async () => {
    getIdentityKeyMock.mockResolvedValue(defaultIdentityKey);

    // Create test data array
    const testData: number[][] = [
      Utils.toArray('19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut'),
      Utils.toArray('test message'),
      Utils.toArray('text/plain'),
      Utils.toArray('utf-8'),
      Utils.toArray('test.txt')
    ];

    const result = await signOpReturnData(mockKeyVault, { data: testData });
    expect(result).toBeDefined();
    expect(result?.type).toBe('signatures');
    expect(result?.data).toEqual([
      Utils.toArray('mock_address'),
      Utils.toArray('mock_signature')
    ]);
    expect(mockFromBackup).toHaveBeenCalledWith({
      derivedPrivateKey: defaultPrivateKey.toWif(),
      name: 'BAP ID 1',
      description: 'BAP ID 1',
      address: defaultPrivateKey.toAddress(),
      identityAttributes: {}
    });
    expect(mockSignMessage).toHaveBeenCalledWith(testData);
  });

  test('signs hex data with identity key', async () => {
    getIdentityKeyMock.mockResolvedValue(defaultIdentityKey);

    const testData: number[][] = [Utils.toArray('deadbeef')];
    const result = await signOpReturnData(mockKeyVault, { data: testData });
    expect(result).toBeDefined();
    expect(result?.type).toBe('signatures');
    expect(result?.data).toEqual([
      Utils.toArray('mock_address'),
      Utils.toArray('mock_signature')
    ]);
    expect(mockFromBackup).toHaveBeenCalledWith({
      derivedPrivateKey: defaultPrivateKey.toWif(),
      name: 'BAP ID 1',
      description: 'BAP ID 1',
      address: defaultPrivateKey.toAddress(),
      identityAttributes: {}
    });
    expect(mockSignMessage).toHaveBeenCalledWith(testData);
  });
}); 