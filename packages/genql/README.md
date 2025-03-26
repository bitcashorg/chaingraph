# @chaingraph/genql

> ⚠️ **Work in Progress**: This package is currently under active development.

A GraphQL client generator for the ChainGraph API, built with [genql](https://github.com/remorses/genql).

## Overview

This package provides type-safe GraphQL operations for interacting with the ChainGraph API. It automatically generates TypeScript types and query builders based on the ChainGraph GraphQL schema.

## Installation

```bash
npm install @chaingraph/genql
# or
yarn add @chaingraph/genql
# or
pnpm add @chaingraph/genql
# or
bun add @chaingraph/genql
```

## Usage

```typescript
import { createClient } from '@chaingraph/genql'

const client = createClient({
  // Configure your client options here
})

// Use the generated types and queries
```

## Development

To generate the GraphQL client:

```bash
npm run gen
# or
yarn gen
# or
pnpm gen
# or
bun run gen
```

## License

MIT
