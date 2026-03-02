# React Native Vibe Code

The first open-source IDE that creates mobile apps with AI. Build React Native and Expo applications through natural language.

Try it on [reactnativevibecode.com](https://reactnativevibecode.com)

[![SPONSORED BY E2B FOR STARTUPS](https://img.shields.io/badge/SPONSORED%20BY-E2B%20FOR%20STARTUPS-ff8800?style=for-the-badge)](https://e2b.dev/startups)

## Stack

- **Frontend**: Next.js 14, shadcn/ui, TailwindCSS
- **Mobile**: React Native, Expo
- **AI**: Anthropic Claude (via Claude Code)
- **Sandboxing**: E2b and Daytona SDK for secure code execution
- **Database**: PostgreSQL (Neon)
- **Auth**: Better Auth

## Requirements

- Node.js 18+
- npm or pnpm
- Anthropic Claude Code (currently required for AI functionality)
- E2B API key for sandboxing (Daytona integration coming soon)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/react-native-vibe-code/react-native-vibe-code-sdk.git react-native-vibe-code

cd react-native-vibe-code
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Create a `.env.local` file:

```bash
# Required
E2B_API_KEY="your-daytona-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Database
DATABASE_URL="your-postgresql-connection-string"
BETTER_AUTH_SECRET="your-auth-secret"

# Optional
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Set up environment variables for monorepo

The project uses a monorepo structure. Next.js loads environment variables from its app directory (`apps/web/`), not from the root. Create a symlink to make the root `.env.local` accessible:

```bash
ln -s "$(pwd)/.env.local" apps/web/.env.local
```

### 5. Run the development server

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start building mobile apps with AI.

## Deployment

### Vercel Deployment

1. **Fork/Clone the repository** to your GitHub account

2. **Deploy to Vercel**:
   - Connect your GitHub repository to Vercel
   - Import the project

3. **Configure Environment Variables** in Vercel::
   
   **Required Variables:**
   ```
   DATABASE_URL=your-postgresql-connection-string
   BETTER_AUTH_SECRET=your-auth-secret-min-32-chars
   ANTHROPIC_API_KEY=your-anthropic-api-key
   E2B_API_KEY=your-daytona-api-key
   ```
   
   **For Google OAuth (if using):**
   ```
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

   **Important:** Do NOT set `NEXT_PUBLIC_APP_URL` in production. The app will automatically detect the correct URL.

4. **Update OAuth Redirect URLs**:
   - Google OAuth Console: Add `https://your-domain.vercel.app/api/auth/callback/google`
   - Update any other OAuth providers similarly

5. **Deploy** and your app should be live!

### Troubleshooting

- **Mixed Content Errors**: The app automatically uses HTTPS in production. If you see mixed content errors, ensure you're not hardcoding HTTP URLs.
- **Authentication Issues**: Verify your `BETTER_AUTH_SECRET` is set correctly and OAuth redirect URLs match your production domain.

## Usage

1. Open the app in your browser
2. Describe the mobile app you want to build
3. Watch as the AI generates React Native/Expo code
4. Preview (web and native pp options) and test your app in the IDE

## Contributing

As an open-source project, we welcome contributions from the community. If you are experiencing any bugs or want to add some improvements, please feel free to open an issue or pull request.

## Credits

- Created by [ROFI](https://x.com/bidah)
- This codebase was initialized with the [e2b fragments project](https://github.com/e2b-dev/fragments).

## Socials
Follow us for latest updates on X [RNVIBECODE](https://x.com/rnvibecode)