# BRC-100 Integration Research (BSV Only)

**Document Version:** 1.0
**Date:** 2025-10-15
**Purpose:** Research documentation for potential BRC-100/Babbage identity integration
**Scope:** BSV blockchain only (NOT Bitcoin BTC)

---

## Executive Summary

**BRC-100** is the BSV Blockchain Standard Wallet-to-Application Interface, and **Babbage** is its primary implementation framework. This research evaluates integrating BRC-100/Babbage identity system alongside our existing **BAP (Bitcoin Attestation Protocol)** identity management.

### Key Findings

| Finding | Assessment |
|---------|------------|
| **Compatibility** | Complementary but fundamentally different approaches |
| **Integration Feasibility** | Technically possible but complex |
| **Current Recommendation** | **Do not pursue** - Complexity outweighs immediate benefit |
| **Reconsider When** | User demand emerges or BRC-100 ecosystem matures significantly |

### Quick Comparison

| System | Identity Model | Best For | Key Limitation |
|--------|----------------|----------|----------------|
| **BAP** | Hash-based, on-chain attestations | Public credentials, trust chains, searchable identity | All attestations are public |
| **BRC-100/Babbage** | Type-42 derived keys, BRC-52 certificates | Private identity, selective revelation, app integration | Newer ecosystem, less established |

---

## Table of Contents

1. [BRC-100 Technical Overview](#brc-100-technical-overview)
2. [Babbage Implementation Framework](#babbage-implementation-framework)
3. [BAP vs BRC-100 Comparison](#bap-vs-brc-100-comparison)
4. [Integration Options](#integration-options)
5. [Implementation Requirements](#implementation-requirements)
6. [Recommendation](#recommendation)
7. [Key Resources](#key-resources)

---

## BRC-100 Technical Overview

### What is BRC-100?

**BRC-100: BSV Blockchain Standard Wallet-to-Application Interface**
**Authors:** Ty Everett, Tone Engel, Brayden Langley (Project Babbage)
**Status:** Official BSV BRC Standard
**Specification:** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md

BRC-100 defines a **vendor-neutral API** for wallets to communicate with applications, covering:
- Transaction creation and signing
- Identity management
- Key derivation
- Encryption/decryption
- Certificate management
- Mutual authentication

### Core Identity Components

#### 1. Master Identity Key (BRC-42)

```javascript
// User's master keypair
masterPrivateKey → masterPublicKey (secp256k1)

// Master public key = "identity key" for the wallet
// Visible to applications, used for key derivation
```

#### 2. Type-42 Key Derivation (BRC-42 BKDS)

**BSV Key Derivation Scheme** - Two-party key derivation using ECDH:

```javascript
// Derive keys between Party A and Party B
1. Compute ECDH shared secret
   sharedSecret = PartyA_PrivateKey × PartyB_PublicKey

2. Generate invoice-specific scalar
   scalar = HMAC-SHA256(sharedSecret, invoiceNumber)

3. Derive child public key
   childPubKey = PartyB_MasterPubKey + (scalar × G)
```

**Key Features:**
- Each party pair has a private key derivation universe
- Invoice numbers enable unlimited key pairs
- No one else can link transactions between the parties
- Deterministic - same invoice always generates same key

#### 3. Security Levels (BRC-43)

```javascript
Level 0: No restrictions, open access
Level 1: User authorization required for protocol
Level 2: Counterparty-specific permissions required
```

#### 4. Identity Certificates (BRC-52)

```json
{
  "type": "name-certificate",
  "subject": {
    "identityKey": "02a1b2c3...",
    "givenName": "John",
    "familyName": "Doe"
  },
  "certifier": {
    "identityKey": "03d4e5f6...",
    "name": "Trusted Certifier Inc"
  },
  "fields": {
    "givenName": { "value": "John", "encrypted": false },
    "familyName": { "value": "Doe", "encrypted": true },
    "birthDate": { "value": "[encrypted]", "encrypted": true }
  },
  "signature": "...",
  "revocationOutpoint": "txid:vout"
}
```

**Certificate Features:**
- Selective field encryption for privacy
- UTXO-based revocation (spending UTXO = revoked)
- Selective revelation (choose which fields to prove)
- Multiple certificates from different certifiers

#### 5. Mutual Authentication (BRC-103 via Authrite)

Bidirectional peer-to-peer authentication:

```
1. Client → Server: Challenge request
2. Server → Client: Signed challenge + counter-challenge
3. Client → Server: Signed counter-challenge + certificate
4. Both parties verify signatures and certificates
```

### BRC-100 API Methods

```typescript
// Identity & Keys
getPublicKey({ identityKey, protocolID, keyID, counterparty, privileged })
createSignature({ data, protocolID, keyID, counterparty })
verifySignature({ data, signature, protocolID, keyID, counterparty })

// Encryption
encrypt({ plaintext, protocolID, keyID, counterparty })
decrypt({ ciphertext, protocolID, keyID, counterparty })

// Certificates
acquireCertificate({ type, certifier, fields, privileged })
listCertificates({ certifiers, types, limit, offset })
proveCertificate({ certificate, fieldsToReveal, verifier })
relinquishCertificate({ type, serialNumber })
discoverByIdentityKey({ identityKey, limit, offset })
discoverByAttributes({ attributes, limit, offset })

// Transactions
createAction({ description, inputs, outputs })
signAction({ spends, reference })
abortAction({ reference })
```

---

## Babbage Implementation Framework

### Critical Clarification

**Babbage is NOT a competing identity system to BRC-100.**
Babbage is the primary development framework that **implements** BRC-100 and related BRC standards.

### What is Project Babbage?

**Project Babbage** is a comprehensive development ecosystem for BSV applications.

**Components:**
- **Babbage SDK** (`@babbage/sdk-ts`) - TypeScript SDK implementing BRC-100
- **Metanet Desktop** - Reference BRC-100 wallet implementation
- **Authrite** - BRC-103 mutual authentication library
- **Computing with Integrity (CWI)** - Kernel for user-owned identities

### Babbage Identity Features

#### Single Identity Layer
- Users have one account, one password, one master keyset
- Applications plug into user identities via BRC-100 interface
- No per-app accounts or passwords

#### Passwordless Authentication
- Uses cryptographic challenge-response
- No passwords sent over network
- Mutual authentication (both parties verify each other)

#### Privacy by Default
- Applications don't see other applications' data
- User controls attribute revelation
- Encrypted certificate fields

### Babbage SDK Example

```typescript
import { getPublicKey, createSignature, encrypt } from '@babbage/sdk-ts'

// Get identity public key
const pubKey = await getPublicKey({
  identityKey: true
})

// Sign data for specific app
const signature = await createSignature({
  data: [1, 2, 3, 4],
  protocolID: 'my-app',
  keyID: '1'
})

// Encrypt message for counterparty
const ciphertext = await encrypt({
  plaintext: [72, 101, 108, 108, 111], // "Hello"
  protocolID: 'messaging',
  keyID: '1',
  counterparty: '03abc...' // Recipient's public key
})
```

---

## BAP vs BRC-100 Comparison

### Identity Key Generation

#### BAP
```javascript
// Step 1: Root address from wallet
rootAddress = "1WffojxvgpQBmUTigoss7VUdfN45JiiRK"

// Step 2: Hash to identity key
identityKey = base58(ripemd160(sha256(rootAddress)))
// Result: "3SyWUZXvhidNcEHbAC3HkBnKoD2Q"
```

#### BRC-100
```javascript
// Step 1: Master keypair
masterPrivateKey = random256bits()
masterPublicKey = secp256k1(masterPrivateKey)

// Step 2: Master public key IS the identity
identityKey = masterPublicKey
// Result: "02a1b2c3d4e5f6..." (33-byte compressed public key)
```

### Attestation/Cert Storage

#### BAP
```
On-chain transaction:
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ATTEST
  <attestationHash>
  <sequence>
| AIP signature

Searchable via blockchain indexers
All attestations are public (hashed)
```

#### BRC-100
```javascript
{
  type: "certificate",
  subject: { /* encrypted fields */ },
  certifier: { /* public key */ },
  signature: "...",
  revocationOutpoint: "txid:vout"
}

Can be stored off-chain
Selective field revelation
Private by default
```

### Key Derivation

#### BAP
```
Fixed identity key derived once from root address
Signing keys rotated via on-chain ID transactions
All rotations are public and traceable
```

#### BRC-100 (Type-42)
```
Unlimited keys derived deterministically
Each counterparty has separate key universe
Keys derived on-demand, no on-chain record
Private key relationships
```

### Verification Process

#### BAP
```
1. Query blockchain indexer for attestations by identity key
2. Verify signatures using AIP
3. Check attestation hashes match claimed attributes
4. Verify signing address is current (not rotated out)
```

#### BRC-100
```
1. Request certificate from subject
2. Verify certificate signature by certifier
3. Check revocation UTXO (if spent → invalid)
4. Verify selective revelation proofs
```

### Use Cases

#### BAP Ideal For:
- ✅ Public identity and reputation
- ✅ KYC/compliance with multiple attesters
- ✅ Building chains of trust
- ✅ Blockchain-auditable credentials
- ✅ Cross-service identity portability

#### BRC-100 Ideal For:
- ✅ Private identity interactions
- ✅ Selective attribute disclosure
- ✅ Complex application integrations
- ✅ Privacy-first applications
- ✅ Passwordless authentication

---

## Integration Options

### Option 1: BAP as BRC-43 Protocol

Map BAP identity to BRC-100 protocol ID:

```typescript
interface BapProtocolIdentity {
  protocolID: 'bap-identity'
  keyID: 'attestation-key'
  securityLevel: 1

  metadata: {
    bapIdentityKey: '3SyWUZXvhidNcEHbAC3HkBnKoD2Q'
    bapRootAddress: '1Wffo...'
    bapSigningAddress: '1K4c6...'
  }
}

// BRC-100 wallet stores mapping
// When BAP operation needed:
//   - Use stored BAP identity key
//   - Sign with BAP root address (not BRC-42 key)
//   - Post BAP transaction to blockchain
```

**Pros:**
- BRC-100 wallet can manage BAP credentials
- Unified wallet interface
- No BAP protocol changes needed

**Cons:**
- Two separate identity trees to maintain
- No cryptographic linkage between systems
- Added complexity in wallet
- User confusion about which identity to use

### Option 2: BAP Attestation Bridge

Create BRC-52 certificates that reference BAP attestations:

```typescript
interface BapBridgeCertificate {
  type: 'bap-attestation-certificate'
  certifier: 'bap-bridge-service'
  fields: {
    bapIdentityKey: {
      value: '3SyWUZXvhidNcEHbAC3HkBnKoD2Q'
      encrypted: false
    }
    bapAttestationTxid: {
      value: '7f8e9d...'
      encrypted: false
    }
    attestedAttribute: {
      value: 'name'
      encrypted: false
    }
    attributeValue: {
      value: 'John Doe'
      encrypted: true  // Selective revelation
    }
  }
  revocationOutpoint: '...'
}
```

**Workflow:**
1. User has BAP identity with on-chain attestations
2. Bridge service creates BRC-52 certificates referencing them
3. BRC-100 wallet stores certificates
4. When proving: share certificate + verifier checks BAP on-chain

**Pros:**
- Leverages existing BAP ecosystem
- Adds selective revelation to BAP
- Maintains public verifiability
- Migration path for BAP users

**Cons:**
- Requires bridge service
- More complex verification
- Dependency on off-chain component

### Option 3: Parallel Identity Management

BRC-100 wallet manages multiple identity systems independently:

```typescript
interface MultiIdentityWallet {
  // BRC-100 native
  brc100: {
    masterPublicKey: '02a1b2c3...'
    certificates: [...]
    keyDerivation: 'BRC-42'
  }

  // BAP (separate)
  bap: {
    identityKey: '3SyWUZXvhidNcEHbAC3HkBnKoD2Q'
    rootAddress: '1Wffo...'
    attestations: [...]
  }

  proveIdentity(type: 'brc100' | 'bap'): Proof
}
```

**Pros:**
- Clean separation
- Each system works as designed
- Unified wallet interface

**Cons:**
- No integration, just coexistence
- Duplicate identity management
- Users must understand both

---

## Implementation Requirements

### For Any Integration Approach

#### 1. Wallet Implementation
```typescript
// BRC-100 wallet must implement:
- BAP transaction creation (ATTEST, ID, etc.)
- Key storage for both identity systems
- UI for managing both identity types
- User guidance on when to use each
```

#### 2. Bridge Services
```typescript
// Required services:
- BAP attestation indexer
- Certificate generation (for Option 2)
- API for querying BAP attestations
```

#### 3. Standards Documentation
```markdown
- Formal BRC defining integration (e.g., BRC-110)
- Reference implementation
- Migration guide for BAP users
- Security considerations
```

#### 4. Developer Tools
```typescript
// SDK additions:
- BAP operation methods in BRC-100 context
- Testing frameworks
- Example applications
```

---

## Recommendation

### Current Assessment: DO NOT PURSUE

**Reasoning:**

1. **No User Demand**
   - No evidence users need both identity systems
   - BAP well-established in our stack
   - BRC-100 ecosystem still emerging

2. **High Complexity**
   - Requires bridge service or dual identity management
   - New BRC specification needed
   - Significant engineering effort

3. **Limited Value**
   - Both solve similar problems differently
   - Use cases don't overlap significantly
   - Integration doesn't create new capabilities

4. **Ecosystem Maturity**
   - BRC-100 still being adopted
   - Limited tooling and examples
   - BAP has established community

5. **Maintenance Burden**
   - Would need to maintain two identity systems
   - Keep up with changes in both protocols
   - Support both in UI/UX

### When to Reconsider

✅ **Reconsider integration if:**
- Users explicitly request BRC-100 compatibility
- BRC-100 ecosystem matures significantly
- Applications requiring cross-system identity emerge
- Standardized bridge protocol emerges in BSV community
- BAP limitations become blocking for users

### Alternative Approach

Instead of full integration, consider:

1. **Monitor BRC-100 Ecosystem**
   - Track adoption and tooling maturity
   - Identify killer apps using BRC-100

2. **Document Interop Patterns**
   - How users can use both independently
   - Export/import between systems

3. **Participate in Standards**
   - Contribute to BRC discussions
   - Share BAP use cases and requirements

4. **Keep Architecture Open**
   - Design for future multi-identity support
   - Abstract identity operations where possible

---

## Key Resources

### Official Specifications

- **BRC-100:** https://github.com/bitcoin-sv/BRCs/blob/master/wallet/0100.md
- **BRC-42 (BKDS):** https://bsv.brc.dev/key-derivation/0042
- **BRC-43 (Protocol IDs):** https://bsv.brc.dev/key-derivation/0043
- **BRC-52 (Certificates):** https://bsv.brc.dev/peer-to-peer/0052
- **BRC-103 (Authrite):** https://bsv.brc.dev/peer-to-peer/0031

### Implementation Resources

- **ts-sdk:** https://github.com/bsv-blockchain/ts-sdk
  - Official BSV TypeScript SDK
  - Implements BRC standards
  - Reference for key derivation, transactions, etc.

- **Babbage SDK:** https://github.com/p2ppsr/babbage-sdk
  - BRC-100 implementation
  - Client-side SDK for applications

- **Metanet Desktop:** https://github.com/bitcoin-sv/metanet-desktop
  - Reference BRC-100 wallet

- **Authrite:** https://github.com/bitcoin-sv/auth-express-middleware
  - BRC-103/104 mutual authentication

### BAP Resources

- **BAP Protocol:** https://github.com/icellan/bap
- **BAP API:** https://bap-api.com/
- **Go-BAP:** https://github.com/BitcoinSchema/go-bap

### Documentation

- **BSV Docs:** https://docs.bsvblockchain.org/
- **Project Babbage:** https://docs.projectbabbage.com/
- **BRC Directory:** https://bsv.brc.dev/

---

## Conclusion

BRC-100/Babbage and BAP are complementary identity systems serving different use cases. While integration is technically feasible, the complexity and maintenance burden outweigh the immediate benefits given current ecosystem maturity and lack of user demand.

**Recommendation:** Continue with BAP as primary identity system. Monitor BRC-100 ecosystem development and revisit integration decision if compelling use cases or user demand emerges.

---

**Document Status:** Complete
**Last Updated:** 2025-10-15
**Next Review:** When BRC-100 adoption increases or user requests emerge
