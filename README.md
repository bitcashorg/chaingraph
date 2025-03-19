# ChainGraph: Real-Time GraphQL Toolkit for EOSIO/Antelope

ChainGraph is a real-time GraphQL toolkit designed for EOSIO/Antelope blockchain applications. It offers powerful tools for data subscriptions and querying across multiple blockchains.

> 🚧 Note: Migration from previous repos in progress (80% complete) - feel free to explore and contribute! 🏗️

## Project Structure

### Apps
- [__apps/web__](./apps/web/README.md) - Frontend interface
- [__apps/auth__](./apps/auth/README.md) - Authentication service
- [__apps/chaingraph.io__](./apps/chaingraph.io/README.md) - Main website
- [__apps/docs__](./apps/docs/README.md) - Documentation site
- [__apps/engine__](./apps/engine/README.md) - Core processing engine
- [__apps/explorer__](./apps/explorer/README.md) - Graph data explorer
- [__apps/node__](./apps/node/README.md) - Node service

### Packages
- [__packages/ui__](./packages/ui/README.md) - UI components
- [__packages/core__](./packages/core/README.md) - Blockchain interactions, contract ABIs
- [__packages/api__](./packages/api/README.md) - GraphQL API client, SDK, and hooks
- [__packages/react__](./packages/react/README.md) - React hooks for blockchain data
- [__packages/supabase__](./packages/supabase/README.md) - Database integration
- [__packages/lib__](./packages/lib/README.md) - Shared utilities
- [__packages/errors__](./packages/errors/README.md) - Error handling
- [__packages/mappings__](./packages/mappings/README.md) - Data mappings
- [__packages/next__](./packages/next/README.md) - Next.js utilities
- [__packages/tsconfig__](./packages/tsconfig/README.md) - TypeScript configuration

## Development Setup

### Requirements
- Node.js 18+
- pnpm

### Quick Start

```bash
npm install -g pnpm
git clone https://github.com/chaingraph/chaingraph.git
cd chaingraph
pnpm install
```

### Development Commands

```bash
pnpm backend    # Start backend services
pnpm dev        # Dev server
pnpm build      # Production build
pnpm test       # Run tests
```

## Features

- **Real-Time Data Streaming** – Stream blockchain data in real-time.
- **GraphQL Subscriptions** – Subscribe to blockchain events.
- **Multi-Blockchain Querying** – Query across multiple blockchain networks.
- **Developer-Friendly Interface** – Intuitive tools for developers.

## Technologies Used

- **Antelope** – Blockchain framework
- **Node.js** – Server-side JavaScript
- **GraphQL** – API query language
- **Docker** – Containerization
- **GCP** – Cloud platform
- **RXJS** – Reactive programming
- **ReactJS** – Frontend library
- **TypeScript** – Typed JavaScript

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT License

