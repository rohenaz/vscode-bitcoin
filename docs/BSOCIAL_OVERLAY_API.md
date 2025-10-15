# BSocial Overlay API Reference

**Base URL:** `https://api.sigmaidentity.com` (alias: `https://bsocial-overlay-production.up.railway.app`)

**Repository:** https://github.com/b-open-io/bsocial-overlay

This is a BSV overlay service that indexes and provides lookup services for:
- **BAP (Bitcoin Attestation Protocol)** - Identity management and attestations
- **BSocial** - Social media posts and interactions

## API Endpoints

### Identity Management

#### 1. Get Identity by ID Key

Retrieve a complete BAP identity by its identity key.

```http
POST /api/v1/identity/get
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
      "description": "Developer",
      "image": "txid_or_url",
      "url": "https://example.com",
      "paymail": "johnny@relysia.com"
    }
  }
}
```

**TypeScript Interface:**
```typescript
interface Identity {
  idKey: string;           // BAP identity key (27 characters, base58)
  firstSeen: number;       // Block height when first seen
  rootAddress: string;     // Original root address
  currentAddress: string;  // Current signing address
  addresses: Address[];    // History of addresses
  identity?: Profile;      // Schema.org profile data (optional)
}

interface Address {
  address: string;
  txId: string;
  block: number;
}

interface Profile {
  "@context": "https://schema.org";
  "@type": "Person";
  alternateName?: string;
  description?: string;
  image?: string;
  url?: string;
  paymail?: string;
  banner?: string;
  homeLocation?: {
    "@type": "Place";
    name: string;
  };
}
```

**Used in:** `bapService.ts:259-287`

---

#### 2. Validate Identity by Address

Check if an address is valid for a BAP identity at a specific block/timestamp.

```http
POST /api/v1/identity/validByAddress
Content-Type: application/json

{
  "address": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo",
  "block": 800000,      // Optional: validate at specific block
  "timestamp": 0        // Optional: validate at specific timestamp
}
```

**Response:**
```json
{
  "status": "OK",
  "result": {
    "identity": {
      "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
      "rootAddress": "1WffojxvgpQBmUTigoss7VUdfN45JiiRK",
      "currentAddress": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo",
      "addresses": [...]
    },
    "validityRecord": {
      "valid": true,
      "block": 800000,
      "timestamp": 1612137600
    },
    "profile": {
      "@type": "Person",
      "alternateName": "Johnny"
    }
  }
}
```

**Used in:** `bapService.ts:289-315`

---

#### 3. Search Identities

Search for BAP identities by name or identity key.

```http
GET /api/v1/identity/search?q=johnny&limit=20&offset=0
```

**Query Parameters:**
- `q` (required): Search query string
- `limit` (optional): Maximum results to return (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "status": "OK",
  "result": [
    {
      "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
      "firstSeen": 1234567890,
      "rootAddress": "1WffojxvgpQBmUTigoss7VUdfN45JiiRK",
      "currentAddress": "1K4c6YXR1ixNLAqrL8nx5HUQAPKbACTwDo",
      "identity": {
        "alternateName": "Johnny",
        "description": "Developer"
      }
    }
  ]
}
```

---

### Profile Management

#### 4. Get Profile by BAP ID

Retrieve just the profile data for a BAP identity.

```http
GET /api/v1/profile/:bapId
```

**Example:**
```http
GET /api/v1/profile/3SyWUZXvhidNcEHbAC3HkBnKoD2Q
```

**Response:**
```json
{
  "status": "OK",
  "result": {
    "@context": "https://schema.org",
    "@type": "Person",
    "alternateName": "Johnny",
    "description": "Developer",
    "image": "txid",
    "url": "https://example.com"
  }
}
```

---

#### 5. List All Profiles

Get a paginated list of all BAP profiles.

```http
GET /api/v1/profile?limit=20&offset=0
```

**Query Parameters:**
- `limit` (optional): Maximum results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "status": "OK",
  "result": [
    {
      "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
      "identity": {
        "alternateName": "Johnny",
        "description": "Developer"
      }
    }
  ]
}
```

---

#### 6. Get Profile Image/Banner

Retrieve a specific field from a profile (typically `image` or `banner`).

```http
GET /api/v1/person/:field/:bapId
```

**Examples:**
```http
GET /api/v1/person/image/3SyWUZXvhidNcEHbAC3HkBnKoD2Q
GET /api/v1/person/banner/3SyWUZXvhidNcEHbAC3HkBnKoD2Q
```

**Response:** Binary image data with appropriate `Content-Type` header

**Supported URL formats in profile:**
- Transaction ID: `096b5fdcb6e88f8f0325097acca2784eabd62cd4d1e692946695060aff3d6833_7`
- Ordinals path: `/096b5fdcb6e88f8f0325097acca2784eabd62cd4d1e692946695060aff3d6833_7`
- HTTPS URL: `https://ordfs.network/txid`
- BitFS protocol: `bitfs://txid.out.0.0`
- Data URL: `data:image/jpeg;base64,...`

**Default fallback:** Returns default avatar if field not found.

---

### Post Search

#### 7. Search Posts

Search for BSocial posts by content.

```http
GET /api/v1/post/search?q=bitcoin&limit=20&offset=0
```

**Query Parameters:**
- `q` (required): Search query string
- `limit` (optional): Maximum results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "status": "OK",
  "result": [
    {
      "txid": "abc123...",
      "content": "Bitcoin is digital gold",
      "timestamp": 1612137600,
      "author": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q"
    }
  ]
}
```

---

### Autofill / Combined Search

#### 8. Autofill Search

Search both identities and posts simultaneously (useful for @ mentions and search).

```http
GET /api/v1/autofill?q=johnny
```

**Query Parameters:**
- `q` (required): Search query string

**Response:**
```json
{
  "status": "OK",
  "result": {
    "identities": [
      {
        "idKey": "3SyWUZXvhidNcEHbAC3HkBnKoD2Q",
        "identity": {
          "alternateName": "Johnny"
        }
      }
    ],
    "posts": [
      {
        "txid": "abc123...",
        "content": "Post mentioning johnny"
      }
    ]
  }
}
```

**Caching:** Results are cached for 15 minutes in Redis.

---

### Transaction Ingestion

#### 9. Ingest Transaction

Submit a transaction to be processed by the overlay service.

```http
POST /api/v1/ingest
Content-Type: application/octet-stream

<raw transaction bytes>
```

**Response:**
```json
{
  "status": "OK",
  "result": {
    "txid": "abc123def456..."
  }
}
```

**Notes:**
- Transaction must include input transactions (BEEF format preferred)
- Processes both `tm_bap` and `tm_bsocial` topics
- Automatically broadcasts to peers

---

### Real-time Subscriptions

#### 10. Subscribe to Topics

Subscribe to real-time updates using Server-Sent Events (SSE).

```http
GET /api/v1/subscribe/:topics
```

**Examples:**
```http
GET /api/v1/subscribe/tm_bap
GET /api/v1/subscribe/tm_bap,tm_bsocial
GET /api/v1/subscribe/id:3SyWUZXvhidNcEHbAC3HkBnKoD2Q
```

**Response:** Server-Sent Events stream

```
event: tm_bap
id: 1612137600000000000
data: {"txid":"abc123...","type":"ID"}

event: tm_bsocial
id: 1612137600000000001
data: {"txid":"def456...","type":"POST"}
```

**Topics:**
- `tm_bap` - All BAP transactions (ID, ATTEST, REVOKE, ALIAS)
- `tm_bsocial` - All BSocial posts and interactions
- `id:{bapId}` - Activity for specific identity

---

## Data Structures

### BAP Transaction Types

The overlay processes four types of BAP transactions:

#### ID Transaction (Identity Creation/Rotation)
```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ID
  [Identity Key]
  [New Signing Address]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Root/Previous Address]
  [Signature]
```

#### ATTEST Transaction
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

#### REVOKE Transaction
```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  REVOKE
  [Attestation Hash]
  [Sequence]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Signing Address]
  [Signature]
```

#### ALIAS Transaction (Profile)
```
OP_RETURN
  1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT
  ALIAS
  [Identity Key]
  [JSON Profile Data]
  |
  15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva
  BITCOIN_ECDSA
  [Signing Address]
  [Signature]
```

---

## Environment Configuration

The overlay service uses these environment variables:

```bash
# MongoDB connection
MONGO_URL=mongodb://localhost:27017

# Redis for caching and pubsub
REDIS=redis://localhost:6379
REDIS_BEEF=redis://localhost:6379  # Transaction storage

# Block headers service
BLOCK_HEADERS_URL=https://headers.chain.mn
BLOCK_HEADERS_API_KEY=your_api_key

# ARC broadcaster
ARC_API_KEY=your_arc_key
ARC_CALLBACK_TOKEN=your_callback_token

# Peer overlay services (comma-separated)
PEERS=https://api.sigmaidentity.com,https://other-overlay.com

# Public hosting URL
HOSTING_URL=https://api.sigmaidentity.com

# Server port
PORT=3000
```

---

## Usage in VSCode Bitcoin Extension

### Current Implementation

The extension uses **two endpoints**:

1. **Get Identity** (`bapService.ts:259-287`)
   ```typescript
   const response = await fetch(`${baseUrl}/v1/identity/get`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ idKey })
   });
   ```

2. **Validate by Address** (`bapService.ts:289-315`)
   ```typescript
   const response = await fetch(`${baseUrl}/v1/identity/validByAddress`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ address })
   });
   ```

### Configuration

Default base URL: `https://api.sigmaidentity.com`

Can be configured in VSCode settings:
```json
{
  "bitcoin.bapIndexerUrl": "https://api.sigmaidentity.com"
}
```

See: `bapService.ts:56-59`

---

## Client Libraries

### TypeScript/JavaScript

**bsv-bap library:** https://github.com/icellan/bap

```typescript
import { BAP } from 'bsv-bap';

const bap = new BAP({ rootPk: wifKey });
bap.BAP_SERVER = 'https://api.sigmaidentity.com/v1';

// Fetch identity
const identity = await bap.getIdentity(idKey);

// Validate address
const isValid = await bap.isValidAttestationTransaction(tx);
```

### Go

**go-bap library:** https://github.com/BitcoinSchema/go-bap

```go
import "github.com/b-open-io/bsocial-overlay/bap"

lookup := bap.NewLookupService(mongoURL, "bap", publisher)
identity, err := lookup.LoadIdentityById(ctx, bapId)
```

---

## Rate Limiting

- **Autofill endpoint:** Cached for 15 minutes per query
- **Real-time subscriptions:** 25 message buffer per client
- **Peer sync:** Configurable concurrency (1 for BAP, 16 for BSocial)

---

## Error Responses

All errors follow the format:

```json
{
  "status": "ERROR",
  "message": "Descriptive error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (identity doesn't exist)
- `500` - Internal Server Error

---

## Related Documentation

- **BAP Protocol:** See `/docs/BAP_RESEARCH.md`
- **Repository:** https://github.com/b-open-io/bsocial-overlay
- **Production:** https://api.sigmaidentity.com
- **Alt URL:** https://bsocial-overlay-production.up.railway.app

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**API Version:** v1
