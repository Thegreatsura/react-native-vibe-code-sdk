# @react-native-vibe-code/error-manager

Centralized error detection, notification, and display system for React Native Vibe Code. Handles real-time error detection from Expo/Metro server logs, Expo error page extraction, and client-side error UI components.

## Overview

This package provides:

- **Server-side error detection**: Pattern-based detection of runtime errors in Expo and Convex server logs
- **Expo error page extraction**: Parses Expo error pages (HTML) to extract full error details including code frames and stack traces
- **Real-time notifications**: Sends error notifications via Pusher to connected clients
- **Error tracking**: In-memory error tracking with statistics and per-project/sandbox filtering
- **Client-side UI**: React hooks and components for displaying error notifications (cards, toasts, modals)
- **Shared patterns**: Configurable error detection and sensitive data filtering patterns

## Installation

```bash
pnpm add @react-native-vibe-code/error-manager
```

## Entrypoints

The package uses three separate entrypoints to keep server and client code isolated:

| Entrypoint | Import Path | Environment |
|------------|-------------|-------------|
| **Server** | `@react-native-vibe-code/error-manager/server` | Node.js / API routes |
| **Client** | `@react-native-vibe-code/error-manager/client` | React / Browser |
| **Shared** | `@react-native-vibe-code/error-manager/shared` | Both |

The root import (`@react-native-vibe-code/error-manager`) re-exports everything from `shared`.

## Server Usage

### Detecting Errors in Server Logs

```typescript
import {
  detectAndNotifyRuntimeError,
  detectAndNotifyConvexError,
} from '@react-native-vibe-code/error-manager/server'

// In your Expo/Metro stdout handler:
process.on('data', (data: string) => {
  detectAndNotifyRuntimeError(data, projectId)
})

// In your Convex dev server handler:
convexProcess.on('data', (data: string) => {
  detectAndNotifyConvexError(data, projectId)
})
```

These functions match log output against known error patterns, buffer multi-line errors, and send notifications via Pusher.

### Extracting Errors from Expo Error Pages

```typescript
import {
  extractExpoError,
  isExpoErrorPage,
} from '@react-native-vibe-code/error-manager/server'

// In a health check endpoint that fetches the app URL:
const response = await fetch(appUrl)
const html = await response.text()

if (isExpoErrorPage(html)) {
  const error = extractExpoError(html)
  // error contains: error name, file location, code frame, and stack trace
}
```

`extractExpoError` handles two Expo error page formats:
- **`_expo-static-error` JSON**: Parses the embedded JSON script tag for structured error data (name, message, fileName, loc, codeFrame, stack, symbolicated stack)
- **Server Error HTML**: Strips HTML tags and searches for JS error type patterns (SyntaxError, TypeError, etc.)

### Sending Custom Notifications

```typescript
import { sendCustomErrorNotification } from '@react-native-vibe-code/error-manager/server'

await sendCustomErrorNotification(projectId, 'Something went wrong', 'custom', 'custom')
```

### Error Tracking

```typescript
import { ErrorTracker, extractErrorDetails } from '@react-native-vibe-code/error-manager/server'

// Track an error
ErrorTracker.trackSandboxTermination(error, { projectId, sandboxId })

// Query errors
const projectErrors = ErrorTracker.getProjectErrors(projectId)
const stats = ErrorTracker.getErrorStats()

// Extract details from any error object
const details = extractErrorDetails(unknownError)
```

## Client Usage

### useErrorNotifications Hook

The main hook for receiving and displaying error notifications. Supports both Pusher-based notifications (server-side detection) and manual error reporting (e.g., health check detecting an Expo error page).

```typescript
import { useErrorNotifications } from '@react-native-vibe-code/error-manager/client'

function MyComponent({ projectId }: { projectId: string }) {
  const {
    latestError,      // Current error to display (null if dismissed)
    dismissError,     // Dismiss the error card
    reportError,      // Manually report an error (e.g., from health check)
    isModalOpen,      // Whether error details modal is open
    errorModalData,   // Error data for the modal
    handleCloseModal, // Close the modal
    handleSendToFix,  // Send error to chat for fixing
    errors,           // All errors in this session
    clearErrors,      // Clear all errors
  } = useErrorNotifications(projectId, {
    onSendToFix: (message) => {
      // Insert error message into chat input
      setChatInput(message)
    },
    deduplicate: true, // Skip consecutive identical errors (default: true)
  })
}
```

### ErrorNotificationCard

Inline error card that floats above the chat input panel. Uses `ResizeObserver` to dynamically position itself based on the height of the element with `data-chat-input` attribute.

```typescript
import { ErrorNotificationCard } from '@react-native-vibe-code/error-manager/client'

// Inside a relative-positioned container that also contains the chat input:
<div className="relative">
  {latestError && (
    <ErrorNotificationCard
      error={latestError}
      onDismiss={dismissError}
      onSendToFix={handleSendToFix}
      onViewDetails={() => setModalOpen(true)}
    />
  )}
  <ChatInput data-chat-input />
</div>
```

**Important**: The parent container must have `position: relative` and the chat input element must have the `data-chat-input` attribute.

### ErrorToast

Toast-style error notification with "Send to Fix" and "View Details" actions.

```typescript
import { ErrorToast } from '@react-native-vibe-code/error-manager/client'

<ErrorToast
  error={error}
  onDismiss={() => {}}
  onSendToFix={(message) => {}}
  onViewDetails={(error) => {}}
/>
```

### ErrorModal

Full-screen modal for viewing complete error details with metadata badges and monospace formatting.

```typescript
import { ErrorModal } from '@react-native-vibe-code/error-manager/client'

<ErrorModal
  error={errorModalData}
  isOpen={isModalOpen}
  onClose={handleCloseModal}
  onSendToFix={handleSendToFix}
/>
```

### formatErrorForFix

Utility to format an error message for sending to the AI chat.

```typescript
import { formatErrorForFix } from '@react-native-vibe-code/error-manager/client'

const message = formatErrorForFix(error.message)
// Returns: "Fix this error:\n```\n<error message>\n```"
```

## Shared Types and Patterns

### Types

```typescript
import type {
  ErrorNotification,       // Pusher notification payload
  SandboxErrorContext,     // Error tracking context
  ExtractedErrorDetails,   // Extracted error info
  ErrorStats,              // Error statistics
  ErrorSourceConfig,       // Error source configuration
  ErrorBuffer,             // Multi-line error buffer
} from '@react-native-vibe-code/error-manager/shared'
```

### Error Patterns

```typescript
import {
  EXPO_ERROR_PATTERNS,      // React/Expo/Metro error patterns
  CONVEX_ERROR_PATTERNS,    // Convex-specific error patterns
  CONVEX_SUCCESS_PATTERNS,  // Convex success patterns (to skip)
  SENSITIVE_PATTERNS,       // Patterns for sensitive data filtering
} from '@react-native-vibe-code/error-manager/shared'
```

## Error Detection Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Error Sources                                               │
├─────────────────────────────────────────────────────────────┤
│  1. Metro stdout/stderr → detectAndNotifyRuntimeError()      │
│  2. Convex dev server   → detectAndNotifyConvexError()       │
│  3. Health check fetch  → extractExpoError() + reportError() │
│  4. Agent finish event  → triggers health check              │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
          ┌──────────────┐    ┌──────────────────┐
          │ Pusher push  │    │ reportError()    │
          │ (sources 1-2)│    │ (source 3-4)     │
          └──────┬───────┘    └────────┬─────────┘
                 │                     │
                 └──────────┬──────────┘
                            ▼
              ┌──────────────────────────┐
              │ useErrorNotifications()  │
              │ • Deduplicates errors    │
              │ • Filters sensitive data │
              │ • Sets latestError state │
              └────────────┬─────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌───────────────────┐    ┌───────────────────┐
    │ ErrorNotification │    │ ErrorModal        │
    │ Card (inline)     │    │ (full details)    │
    │ • Send to Fix     │    │ • Full message    │
    │ • View Details    │    │ • Send to Fix     │
    └───────────────────┘    └───────────────────┘
```

## Package Structure

```
packages/error-manager/
├── src/
│   ├── index.ts                        # Re-exports shared
│   ├── server/
│   │   ├── index.ts                    # Server exports
│   │   ├── error-notifier.ts           # Pusher-based error notifications
│   │   ├── error-tracker.ts            # In-memory error tracking
│   │   └── expo-error-extractor.ts     # Expo error page parsing
│   ├── client/
│   │   ├── index.ts                    # Client exports
│   │   ├── use-error-notifications.tsx # Main React hook
│   │   ├── error-notification-card.tsx # Inline error card
│   │   ├── error-toast.tsx             # Toast notification
│   │   └── error-modal.tsx             # Full error modal
│   └── shared/
│       ├── index.ts                    # Shared exports
│       ├── types.ts                    # TypeScript interfaces
│       └── patterns.ts                 # Error detection patterns
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## License

MIT
