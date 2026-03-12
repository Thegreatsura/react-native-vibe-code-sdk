# @react-native-vibe-code/convex

Bridge between React Native Vibe Code IDE and the Convex backend platform. Handles project provisioning, credential management, environment variable configuration, and sandbox integration for both platform-managed and user-owned Convex deployments.

## Overview

This package provides:

- **Two provisioning modes**: Platform-managed projects (team-scoped tokens) and user-owned projects (OAuth flow)
- **Management API**: Create, provision, and delete Convex projects using team-scoped tokens
- **OAuth provisioning**: Full OAuth flow for users to connect their own Convex accounts
- **Environment variable management**: Read/write deployment env vars with automatic retry logic
- **Convex Auth setup**: Generates RSA key pairs and configures JWT authentication
- **Sandbox integration**: Write credentials to E2B sandboxes and start the Convex dev server

## Installation

```bash
pnpm add @react-native-vibe-code/convex
```

## Usage

### Platform-Managed Projects

Create and provision a Convex project owned by the platform's team:

```typescript
import {
  provisionManagedConvexProject,
  deleteManagedProject,
  getManagedProjectId,
} from '@react-native-vibe-code/convex'

// Provision a new managed project (creates project + deployment in one call)
const result = await provisionManagedConvexProject(
  teamSlug,        // Platform's Convex team slug
  projectSlug,     // Unique project identifier
  teamScopedToken, // Platform's team-scoped API token
)
// result: { deploymentUrl, adminKey, deploymentName }

// Delete a managed project
const projectId = await getManagedProjectId(teamSlug, projectSlug, token)
await deleteManagedProject(projectId, token)
```

### OAuth User-Owned Projects

Full OAuth flow for users to provision projects in their own Convex account:

```typescript
import {
  getOAuthAuthorizeUrl,
  provisionConvexProject,
} from '@react-native-vibe-code/convex'

// Step 1: Redirect user to Convex OAuth
const authorizeUrl = getOAuthAuthorizeUrl({
  clientId: process.env.CONVEX_OAUTH_CLIENT_ID!,
  redirectUri: 'https://yourapp.com/callback',
  state: 'random-state',
})

// Step 2: After callback, provision the full project
const result = await provisionConvexProject(
  authorizationCode,
  process.env.CONVEX_OAUTH_CLIENT_ID!,
  process.env.CONVEX_OAUTH_CLIENT_SECRET!,
  redirectUri,
)
// result: { token, deploymentUrl, teamSlug, projectSlug, deploymentName, accessToken }
```

### Environment Variables

Read and write environment variables on a running Convex deployment:

```typescript
import {
  queryEnvVariableWithRetries,
  setEnvVariablesWithRetries,
  initializeConvexAuth,
} from '@react-native-vibe-code/convex'

// Read an env var (with 3 automatic retries)
const value = await queryEnvVariableWithRetries(deploymentUrl, adminKey, 'MY_VAR')

// Set multiple env vars
await setEnvVariablesWithRetries(deploymentUrl, adminKey, [
  { name: 'API_KEY', value: 'sk-...' },
  { name: 'DEBUG', value: 'true' },
])

// Initialize Convex Auth (generates JWKS/JWT RSA keys if missing)
await initializeConvexAuth(deploymentUrl, adminKey)
```

### Sandbox Integration

Manage Convex credentials and dev server in E2B sandboxes:

```typescript
import {
  restoreConvexEnvToSandbox,
  startConvexDevServer,
  getConvexCredentials,
  updateSandboxEnvFile,
} from '@react-native-vibe-code/convex'

// Restore credentials from DB to sandbox .env.local
await restoreConvexEnvToSandbox(sandbox, projectId)

// Start the Convex dev server in the sandbox
await startConvexDevServer(sandbox, adminKey, deploymentUrl, projectId)

// Get stored credentials from database
const credentials = await getConvexCredentials(projectId)

// Update a sandbox .env.local file (preserves existing vars)
await updateSandboxEnvFile(sandbox, {
  CONVEX_DEPLOYMENT_URL: 'https://xxx.convex.cloud',
})
```

## Types

```typescript
import type {
  ConvexProject,                 // Project credentials (token, deploymentUrl, slugs)
  ConvexTeam,                    // Team identification (teamSlug)
  ConvexProjectState,            // Union: connected | connecting | failed
  CreateProjectResponse,         // API response with project ID and credentials
  OAuthTokenResponse,            // OAuth token exchange response
  DeploymentProvisionResponse,   // Deployment URL and admin key
  OAuthAuthorizeParams,          // OAuth flow parameters
  ConvexEnvVar,                  // { name: string, value: string }
} from '@react-native-vibe-code/convex'
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Provisioning Modes                                     │
├────────────────────────┬────────────────────────────────┤
│  Management API        │  OAuth Flow                    │
│  (platform-owned)      │  (user-owned)                  │
│                        │                                │
│  Team-scoped token     │  OAuth code → access token     │
│  → createProject       │  → createProject               │
│  → provisionDeployment │  → authorizeAccess             │
│  → adminKey            │  → provisionDeployment         │
│                        │  → deployKey                   │
└───────────┬────────────┴───────────────┬────────────────┘
            │                            │
            └────────────┬───────────────┘
                         ▼
          ┌──────────────────────────────┐
          │  Database Storage            │
          │  convexProjectCredentials    │
          │  • deploymentUrl             │
          │  • deploymentName            │
          │  • adminKey                  │
          │  • mode (oauth | managed)    │
          └──────────────┬───────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
  ┌──────────────────┐    ┌───────────────────┐
  │ Env Variables    │    │ Sandbox Utils     │
  │ • query/set vars │    │ • write .env.local│
  │ • init auth keys │    │ • start dev server│
  │ • retry logic    │    │ • error monitoring│
  └──────────────────┘    └───────────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_TEAM_SCOPED_TOKEN` | For managed mode | Platform's team-scoped API token |
| `CONVEX_TEAM_SLUG` | For managed mode | Platform's Convex team slug |
| `CONVEX_OAUTH_CLIENT_ID` | For OAuth mode | OAuth application client ID |
| `CONVEX_OAUTH_CLIENT_SECRET` | For OAuth mode | OAuth application client secret |
| `PROVISION_HOST` | No | Convex API host (default: `https://api.convex.dev`) |
| `DASHBOARD_HOST` | No | Convex dashboard host (default: `https://dashboard.convex.dev`) |

## Package Structure

```
packages/convex/
├── src/
│   ├── index.ts              # Barrel export (re-exports all modules)
│   ├── types.ts              # TypeScript type definitions
│   ├── management-api.ts     # Platform-managed project provisioning
│   ├── provisioning.ts       # OAuth-based project provisioning
│   ├── env-variables.ts      # Deployment env var management + auth setup
│   └── sandbox-utils.ts      # E2B sandbox credential and dev server management
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## License

MIT
