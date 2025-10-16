# Bitcoin Attestation Protocol (BAP) - Comprehensive Research Document

**Document Version:** 1.0  
**Date:** 2025-10-15  
**Research Specialist:** v1.2.0  
**Purpose:** Complete technical reference for BAP identity management UI design

---

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [On-Chain Data Structures](#on-chain-data-structures)
3. [BAP Operations](#bap-operations)
4. [Code Implementation Reference](#code-implementation-reference)
5. [API Documentation](#api-documentation)
6. [Usage Examples](#usage-examples)
7. [Key Management](#key-management)
8. [Security Considerations](#security-considerations)
9. [Implementation Checklist](#implementation-checklist)

---

## Protocol Overview

### What is BAP?

Bitcoin Attestation Protocol (BAP) is a simple protocol to create a chain of trust for any kind of data on the Bitcoin blockchain. It enables identity verification, attestations, key rotation, and privacy-preserving identity management.

### Design Goals

1. **Generic Attestation**: Simple protocol for attesting data without publishing the data itself
2. **Decoupled Funding**: Signing address is separate from funding source address
3. **Key Rotation**: Ability to rotate signing keys without invalidating existing attestations
4. **Multiple Identities**: Create infinite identities while proving attested attributes between them

### Protocol Constants

```javascript
// Bitcom Address
BAP_BITCOM_ADDRESS = "1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT"

// AIP (Author Identity Protocol) Address
AIP_BITCOM_ADDRESS = "15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva"

// HD Derivation Path
SIGNING_PATH_PREFIX = "m/424150'/0'/0'"  // BAP in hex = 0x67656

// Encryption Path  
ENCRYPTION_PATH = "m/424150'/2147483647'/2147483647'"
```

**File References:**
- `/Users/satchmo/code/bsv-bap/src/constants.ts` (lines 4-14)
- `/Users/satchmo/code/go-bap/bap.go` (line 21)

---

## On-Chain Data Structures

### 1. ID Transaction (Identity Creation/Rotation)

#### Initial ID Creation

Creates a new identity by linking an identity key to a signing address.

**Transaction Format:**
```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ID
  [Identity Key]
  [New Signing Address]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Root Address]
  [Signature]
```

**Field Breakdown:**

| Field | Type | Description |
|-------|------|-------------|
| `1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT` | Address | BAP protocol prefix (Bitcom) |
| `ID` | String | Operation type |
| `[Identity Key]` | String (27 chars) | Unique identity key (base58 encoded) |
| `[New Signing Address]` | Address | Bitcoin address for signing |
| `|` | String | Separator (pipe) |
| `15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva` | Address | AIP protocol prefix |
| `BITCOIN_ECDSA` | String | Signing algorithm |
| `[Root Address]` | Address | Address signing this transaction (root for initial) |
| `[Signature]` | Base64 | AIP signature |

**Identity Key Derivation:**

```javascript
// Identity key is derived from root address
identityKey = base58(ripemd160(sha256(rootAddress)))

// Example:
// Root Address: 1WffojxvgpQBmUTigoss7VUdfN45JiiRK
//   ↓ sha256
//   c38bc59316de9783b5f7a8ba19bc5d442f6c9b0988c48a241d1c58a1f4e9ae19
//   ↓ ripemd160  
//   afb3dcf52c2c661c35c8ec6a92cecbfc691ba371
//   ↓ base58
// Identity Key: 3SyWUZXvhidNcEHbAC3HkBnKoD2Q
```

**Code Reference:**
- `/Users/satchmo/code/bsv-bap/src/MasterID.ts` (lines 103-107)
- `/Users/satchmo/code/go-bap/bap.go` (lines 34-69)

#### Key Rotation

```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ID
  [Identity Key]
  [New Signing Address]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Previous Signing Address]  ← signed by previous key, not root
  [Signature]
```

#### Identity Destruction

```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ID
  [Identity Key]
  0                           ← destroys the identity
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Root Address]              ← must use root address
  [Signature]
```

---

### 2. ATTEST Transaction

**Transaction Format:**
```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ATTEST
  [Attestation Hash]
  [Sequence]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Signing Address]
  [Signature]
```

**Attestation URN Process:**

1. Create attribute URN: `urn:bap:id:name:John Doe:e2c6fb4063cc04af58935737eaffc938011dff546d47b7fbb18ed346f8c4d4fa`
2. Hash it: `b17c8e606afcf0d8dca65bdf8f33d275239438116557980203c82b0fae259838`
3. Create attestation URN: `urn:bap:attest:[hash]:3SyWUZXvhidNcEHbAC3HkBnKoD2Q`
4. Hash attestation URN: `89cd658c0ce3ff62db4270a317c35f8a7dfe1242e2cc94232aa3947d77f82431`
5. Use this hash in transaction

**Code Reference:**
- `/Users/satchmo/code/bsv-bap/src/MasterID.ts` (lines 464-488)
- `/Users/satchmo/code/go-bap/bap.go` (lines 71-112)

---

### 3. REVOKE Transaction

```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  REVOKE
  [Attestation Hash]
  [Sequence]                  ← must be > than original
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Signing Address]
  [Signature]
```

---

### 4. ALIAS Transaction (Profile Publishing)

```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ALIAS
  [Identity Key]
  [JSON Data]                 ← Schema.org formatted JSON
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Signing Address]
  [Signature]
```

**JSON Format:**
```json
{
  "@type": "Person",
  "name": "John Doe",
  "alternateName": "Johnny",
  "email": "john@example.com",
  "image": "https://example.com/avatar.jpg",
  "url": "https://example.com",
  "description": "Software developer"
}
```

**Code Reference:**
- `/Users/satchmo/code/vscode-bitcoin/src/bapService.ts` (lines 5-18)

---

## BAP Operations

### Creating a New Identity

```typescript
import { BAP } from 'bsv-bap';
import { HD } from '@bsv/sdk';

// Initialize BAP
const hdPrivateKey = HD.fromRandom().toString();
const bap = new BAP(hdPrivateKey);

// Create identity with attributes
const identityAttributes = {
  name: {
    value: "John Doe",
    nonce: "e2c6fb4063cc04af58935737eaffc938011dff546d47b7fbb18ed346f8c4d4fa"
  },
  email: {
    value: "john@example.com",
    nonce: "2864fd138ab1e9ddaaea763c77a45898dac64a26229f9f3d0f2280e4bfa915de"
  }
};

const identity = bap.newId(undefined, identityAttributes);

// Get identity info
console.log('Identity Key:', identity.getIdentityKey());
console.log('Root Address:', identity.rootAddress);
console.log('Current Address:', identity.getCurrentAddress());

// Get initial ID transaction
const idTransaction = identity.getInitialIdTransaction();

// Export for storage (encrypted)
const exportedIds = bap.exportIds();
```

**File Reference:** `/Users/satchmo/code/bsv-bap/tests/id.test.ts` (lines 36-50)

---

### Managing Attributes

```typescript
const identity = bap.getId(identityKey);

// Add attribute with auto-generated nonce
identity.addAttribute('birthday', '1990-05-22');

// Add with specific nonce
identity.addAttribute('over18', '1', 'specific_nonce_here');

// Get attribute
const name = identity.getAttribute('name');
console.log(name?.value, name?.nonce);

// Get attribute URN
const urn = identity.getAttributeUrn('name');
// Returns: urn:bap:id:name:John Doe:e2c6fb4063...

// Update attribute
identity.setAttribute('name', 'Jane Doe');

// Remove attribute
identity.unsetAttribute('birthday');
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/BaseClass.ts` (lines 72-160)

---

### Key Rotation

```typescript
// Current state
console.log('Current Path:', identity.currentPath);
console.log('Current Address:', identity.getCurrentAddress());

// Increment to next key
identity.incrementPath();

// Generate rotation transaction (signed by previous key)
const rotationTx = identity.getIdTransaction();

// Broadcast rotationTx
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/MasterID.ts` (lines 256-328)

---

### Creating Attestations

```typescript
// Get attestation hash for an attribute
const attestationHash = subject.getAttestationHash('name');

// Create attestation transaction
const attestationTx = bap.signAttestationWithAIP(
  attestationHash,
  attesterIdentityKey,
  0,  // sequence
  ''  // optional data
);
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/index.ts` (lines 386-419)

---

### Verifying Attestations

```typescript
// Verify attestation
const attestation = bap.verifyAttestationWithAIP(opReturnArray);

console.log({
  type: attestation.type,
  hash: attestation.hash,
  verified: attestation.verified
});

// Verify on-chain
const isValid = await bap.isValidAttestationTransaction(opReturnArray);
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/index.ts` (lines 440-482)

---

### Encryption & Decryption

```typescript
// Self-encryption
const ciphertext = identity.encrypt("Sensitive data");
const plaintext = identity.decrypt(ciphertext);

// Two-party encryption (ECIES)
const bobPublicKey = bob.getEncryptionPublicKey();
const ciphertext = alice.encrypt("Secret message", bobPublicKey);
const plaintext = bob.decrypt(ciphertext, alice.getEncryptionPublicKey());

// Seed-based encryption
const seed = "login:example.com";
const pubKey = identity.getEncryptionPublicKeyWithSeed(seed);
const ciphertext = identity.encryptWithSeed("data", seed);
const plaintext = identity.decryptWithSeed(ciphertext, seed);
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/MasterID.ts` (lines 352-461)

---

### Message Signing

```typescript
// Standard signing
const message = toArray("Challenge message", "utf8");
const { address, signature } = identity.signMessage(message);

// Seed-based signing (deterministic)
const seed = "login:example.com";
const { address, signature } = identity.signMessageWithSeed("message", seed);
```

**File Reference:** `/Users/satchmo/code/bsv-bap/src/MasterID.ts` (lines 492-557)

---

## Code Implementation Reference

### Project Structure

#### Main Library: bsv-bap

**Location:** `/Users/satchmo/code/bsv-bap/`

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 714 | Main BAP class, attestations, API calls |
| `src/MasterID.ts` | 663 | Master identity (HD-based) |
| `src/MemberID.ts` | 117 | Member identity (single key) |
| `src/BaseClass.ts` | 316 | Shared base class |
| `src/constants.ts` | 15 | Protocol constants |
| `src/utils.ts` | 78 | Path utilities |
| `src/interface.ts` | 58 | TypeScript interfaces |

#### Go Implementation

**Location:** `/Users/satchmo/code/go-bap/bap.go` (120 lines)

#### VSCode Extension

**Location:** `/Users/satchmo/code/vscode-bitcoin/src/bapService.ts` (317 lines)

---

### Class Architecture

#### BAP Class (Main Controller)

```typescript
class BAP {
  constructor(HDPrivateKey: string, token?: string, server?: string)
  
  // Identity Management
  newId(path?: string, attributes?: IdentityAttributes): MasterID
  getId(identityKey: string): MasterID | null
  setId(bapId: MasterID): void
  removeId(idKey: string): void
  listIds(): string[]
  
  // Import/Export
  importIds(idData: Identities | string, encrypted?: boolean): void
  exportIds(idKeys?: string[], encrypted?: boolean): Identities | string
  exportId(idKey: string, encrypted?: boolean): Identities | string
  
  // Encryption
  encrypt(string: string): string
  decrypt(string: string): string
  
  // Attestations
  signAttestationWithAIP(hash, idKey, counter, data): number[][]
  verifyAttestationWithAIP(tx: number[][]): Attestation
  isValidAttestationTransaction(tx: number[][]): Promise<boolean>
  
  // API Calls
  async getIdentity(idKey: string): Promise<GetIdentityResponse>
  async getIdentityFromAddress(addr: string): Promise<GetIdentityByAddressResponse>
  async getAttestationsForHash(hash: string): Promise<GetAttestationResponse>
  async verifyChallengeSignature(...): Promise<boolean>
}
```

#### MasterID Class (HD Identity)

```typescript
class MasterID {
  constructor(HDPrivateKey: HD, attributes?: IdentityAttributes, idSeed?: string)
  
  // Properties
  idName: string
  description: string
  rootAddress: string
  identityKey: string
  rootPath: string
  currentPath: string
  previousPath: string
  identityAttributes: IdentityAttributes
  
  // Identity Operations
  getIdentityKey(): string
  deriveIdentityKey(address: string): string
  
  // Attributes
  addAttribute(name: string, value: string, nonce?: string): void
  getAttribute(name: string): IdentityAttribute | null
  setAttribute(name: string, value: string | object): void
  unsetAttribute(name: string): void
  getAttributes(): IdentityAttributes
  getAttributeUrn(name: string): string | null
  getAttributeUrns(): string
  
  // Attestations
  getAttestation(urn: string): string
  getAttestationHash(attribute: string): string | null
  
  // Key Management
  incrementPath(): void
  getAddress(path: string): string
  getCurrentAddress(): string
  getRootPath(): string
  
  // Transactions
  getInitialIdTransaction(): number[][]
  getIdTransaction(previousPath?: string): number[][]
  
  // Encryption
  encrypt(data: string, counterPartyPubKey?: string): string
  decrypt(ciphertext: string, counterPartyPubKey?: string): string
  encryptWithSeed(data: string, seed: string, counterPartyPubKey?: string): string
  decryptWithSeed(ciphertext: string, seed: string, counterPartyPubKey?: string): string
  
  // Signing
  signMessage(message: number[], signingPath?: string): { address, signature }
  signMessageWithSeed(message: string, seed: string): { address, signature }
  signOpReturnWithAIP(opReturn: number[][], signingPath?: string): number[][]
  
  // Import/Export
  import(identity: Identity | OldIdentity): void
  export(): Identity
  exportMemberBackup(): MemberIdentity
}
```

#### MemberID Class (Single Key)

```typescript
class MemberID {
  constructor(key: PrivateKey, attributes?: IdentityAttributes)
  
  // Properties
  idName: string
  description: string
  address: string
  identityKey: string
  identityAttributes: IdentityAttributes
  
  // Methods
  signMessage(message: number[]): { address, signature }
  signOpReturnWithAIP(opReturn: number[][]): number[][]
  getPublicKey(): string
  getEncryptionKey(): { privKey, pubKey }
  getEncryptionPublicKey(): string
  encrypt(), decrypt()  // Inherited from BaseClass
  
  // Import/Export
  import(identity: MemberIdentity): void
  export(): MemberIdentity
  static fromMemberIdentity(identity: MemberIdentity): MemberID
  static fromBackup(backup: {wif: string, id: string}): MemberID
}
```

---

## API Documentation

### Sigma Identity API

**Base URL:** `https://api.sigmaidentity.com/v1`

All endpoints use **POST** only.

#### 1. Get Identity by ID Key

```http
POST /identity/get
Content-Type: application/json

{
  "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q"
}
```

**Response:**
```json
{
  "status": "OK",
  "result": {
    "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
    "firstSeen": 1234567890,
    "rootAddress": "1WffojxvgpQBmUTigoss7VUdfN45JiiRK",
    "currentAddress": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo",
    "addresses": [
      {
        "address": "1WffojxvgpQBmUTigoss7VUdfN45JiiRK",
        "txId": "abc123...",
        "block": 700000
      }
    ],
    "identity": {
      "@context": "https://schema.org",
      "@type": "Person",
      "alternateName": "Johnny",
      "description": "Developer"
    }
  }
}
```

#### 2. Get Identity by Address

```http
POST /identity/from-address
Content-Type: application/json

{
  "address": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo"
}
```

#### 3. Validate Address

```http
POST /identity/validByAddress
Content-Type: application/json

{
  "address": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo"
}
```

#### 4. Get Attestations

```http
POST /attestations
Content-Type: application/json

{
  "hash": "89cd658c0ce3ff62db4270a317c35f8a7dfe1242e2cc94232aa3947d77f82431"
}
```

#### 5. Validate Attestation

```http
POST /attestation/valid
Content-Type: application/json

{
  "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
  "address": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo",
  "challenge": "random_challenge_string",
  "signature": "base64_signature"
}
```

---

## Usage Examples

### Example 1: Full Identity Creation

```typescript
import { BAP } from 'bsv-bap';
import { HD } from '@bsv/sdk';

// 1. Initialize
const hdKey = HD.fromRandom().toString();
const bap = new BAP(hdKey);

// 2. Create identity
const identity = bap.newId(undefined, {
  name: { value: "Alice", nonce: Utils.getRandomString() }
});

console.log('Identity Key:', identity.getIdentityKey());
console.log('Root Address:', identity.rootAddress);

// 3. Get ID transaction
const idTxData = identity.getInitialIdTransaction();

// 4. Create and broadcast Bitcoin transaction
// (use @bsv/sdk to create transaction)

// 5. Save identity
const encrypted = bap.exportIds();
// Save encrypted string securely
```

### Example 2: Import and Attest

```typescript
// Import existing identity
const bap = new BAP(hdKey);
bap.importIds(encryptedData);

// Get identities
const alice = bap.getId('aliceIdentityKey');
const bob = bap.getId('bobIdentityKey');

// Bob attests Alice's name
const attestationHash = alice.getAttestationHash('name');
const attestTx = bap.signAttestationWithAIP(
  attestationHash,
  'bobIdentityKey',
  0
);

// Broadcast attestTx
```

### Example 3: Challenge-Response Authentication

```typescript
// Server generates challenge
const challenge = crypto.randomBytes(32).toString('hex');

// Client signs
const identity = bap.getId(identityKey);
const { address, signature } = identity.signMessage(
  toArray(challenge, 'utf8')
);

// Server verifies
const isValid = await bap.verifyChallengeSignature(
  identityKey,
  address,
  challenge,
  signature
);
```

### Example 4: Multi-Identity Management

```typescript
const bap = new BAP(hdKey);

// Create multiple identities
const personal = bap.newId("/0/0/0", {
  name: { value: "John Doe", nonce: getRandomString() }
});

const work = bap.newId("/0/1/0", {
  name: { value: "John D.", nonce: getRandomString() },
  email: { value: "john@company.com", nonce: getRandomString() }
});

const anonymous = bap.newId("/0/2/0", {
  alternateName: { value: "CryptoJohn", nonce: getRandomString() }
});

// List all
console.log('Identities:', bap.listIds());

// Export all
const backup = bap.exportIds();
```

---

## Key Management

### HD Key Derivation

BAP uses BIP32 HD keys with specific derivation:

```
m/424150'/0'/0'/X'/Y'/Z'
│ └─────┘ └─┘ └─┘ └───────┘
│   BAP   │   │      │
│  (hex)  │   │      └─ Identity-specific
│         │   └──────── Reserved (0)
│         └──────────── Reserved (0)
└────────────────────── Master key
```

**Default First Identity:**
- Root: `m/424150'/0'/0'/0'/0'/0'`
- Current: `m/424150'/0'/0'/0'/0'/1'`

### Key Types

#### Master Keys (HD)
- **Format:** xprv...
- **Capabilities:** Create unlimited identities
- **Storage:** Encrypted
- **Use:** Primary wallet

#### Member Keys (Single)
- **Format:** WIF
- **Capabilities:** Single identity
- **Storage:** Can share
- **Use:** Service-specific

### Seed-Based Derivation

```typescript
// Same HD key, different seed = different identity
const id1 = bap.newId(undefined, {}, "seed1");
const id2 = bap.newId(undefined, {}, "seed2");
```

**Purpose:** Adds entropy, harder to discover if HD key compromised.

**Trade-off:** Seed must be stored; if lost, identity cannot be recovered.

### Storage Best Practices

1. **Never store HD private key with identity data**
2. **Export Format:**
   ```typescript
   // Encrypted (default)
   const encrypted = bap.exportIds();
   
   // Unencrypted (debugging only)
   const plain = bap.exportIds(undefined, false);
   ```
3. **Encryption Key:** Uses derived key at `m/424150'/2147483647'/2147483647'`

---

## Security Considerations

### 1. Identity Key Privacy

**Issue:** Identity keys are **not secret** and appear on-chain.

**Mitigation:**
- Use different identities for different contexts
- Don't reuse across services
- Use delegation for linking when needed

### 2. Attribute Nonces

**Purpose:** Prevent dictionary attacks.

```typescript
// GOOD: Random nonce
identity.addAttribute('email', 'user@example.com');  // Auto-generates

// BAD: Predictable nonce
identity.addAttribute('email', 'user@example.com', '12345');  // Attackable
```

### 3. Key Rotation

**Why:** Compromised key, security maintenance, policy

**Process:**
1. Derive new signing key (increment path)
2. Create ID transaction signed by **current** key
3. Broadcast
4. New key becomes current

**Important:** Only **root key** can destroy identity.

### 4. Sequence Numbers

**Purpose:** Prevent replay attacks.

**Rule:** Later transaction with higher sequence supersedes earlier.

### 5. Root Address Protection

**Critical:** Root address should **never** be used except for:
1. Initial identity creation
2. Identity destruction

**Risk:** If root key used elsewhere and compromised, entire identity can be destroyed.

### 6. Attestation Verification

**Always verify:**
1. Signature is valid
2. Signing address is current (check on-chain)
3. Identity chain from root is valid
4. Attestation hasn't been revoked

```typescript
const attestation = bap.verifyAttestationWithAIP(tx);
if (attestation.verified) {
  const isValid = await bap.isValidAttestationTransaction(tx);
}
```

---

## Implementation Checklist

### Phase 1: Identity Creation
- [ ] HD key generation/import
- [ ] Create new identity with attributes
- [ ] Display identity key and addresses
- [ ] Generate initial ID transaction
- [ ] Export encrypted identity data

### Phase 2: Attribute Management
- [ ] Add/edit/remove attributes
- [ ] Display attribute URNs
- [ ] Generate attestation hashes
- [ ] Show/regenerate nonces

### Phase 3: Key Management
- [ ] Display current signing address
- [ ] Show key rotation history
- [ ] Initiate key rotation
- [ ] Display root address (with warning)
- [ ] Path visualization

### Phase 4: Attestations
- [ ] Create attestation for another identity
- [ ] View attestations received
- [ ] Revoke attestation
- [ ] Verify attestation signatures
- [ ] Check validity on-chain

### Phase 5: Profile Management
- [ ] Create ALIAS transaction
- [ ] Edit profile fields
- [ ] Preview profile JSON
- [ ] Fetch profile from indexer

### Phase 6: Advanced Features
- [ ] Multi-identity management
- [ ] Identity delegation
- [ ] Seed-based signing
- [ ] Message signing/verification
- [ ] Encryption/decryption UI
- [ ] QR code generation

### Phase 7: Blockchain Integration
- [ ] Connect to indexer API
- [ ] Fetch identity history
- [ ] Validate attestations on-chain
- [ ] Transaction status monitoring
- [ ] Block explorer links

---

## References

### Source Code Locations

**Primary Library:**
- `/Users/satchmo/code/bsv-bap/` - Main TypeScript implementation
- `/Users/satchmo/code/go-bap/` - Go library

**Implementations:**
- `/Users/satchmo/code/vscode-bitcoin/src/bapService.ts` - VSCode extension
- `/Users/satchmo/code/sigma-auth/lib/bap-utils.ts` - Auth service
- `/Users/satchmo/code/bigblocks.dev/lib/bap-utils.ts` - Web implementation

### External Resources

**Protocol Documentation:**
- GitHub: https://github.com/icellan/bap
- BitcoinSchema: https://github.com/BitcoinSchema/go-bap

**API Endpoints:**
- Sigma Identity: https://api.sigmaidentity.com/v1
- Docs: https://docs.sigmaidentity.com/

### URN Formats

```
urn:bap:id:[attribute]:[value]:[nonce]
urn:bap:attest:[hash]:[identityKey]
urn:bap:revoke:[hash]:[identityKey]
```

### Protocol Addresses

- BAP: `1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT`
- AIP: `15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva`

---

## Glossary

**BAP** - Bitcoin Attestation Protocol

**Identity Key** - 27-character base58 string derived from root address

**Root Address** - First address in identity chain; for creation/destruction only

**Signing Address** - Current active address for signing

**Attestation** - Cryptographic claim about identity attribute

**URN** - Uniform Resource Name; standardized format

**AIP** - Author Identity Protocol; for signing BAP transactions

**HD Key** - Hierarchical Deterministic key

**Member Key** - Single WIF key for limited access

**Nonce** - Random string to prevent dictionary attacks

**Sequence** - Counter to prevent replay attacks

**Schema.org** - Standard vocabulary for structured data

**ECIES** - Elliptic Curve Integrated Encryption Scheme

**Bitcom** - Protocol for identifying OP_RETURN data types

---

**Document End**

*Research completed: 2025-10-15*  
*For updates, see source repositories in References section*
