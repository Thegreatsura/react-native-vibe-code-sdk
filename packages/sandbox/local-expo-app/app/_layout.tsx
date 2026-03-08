// NEVER DELETE THIS COMPONENT <FloatingChatWrapper> is part of capsule app
// IMPORTANT: NEVER REMOVE useHoverWithChannel import and hook from this file
import { FloatingChatWrapper } from '@/features/floating-chat'
import { useColorScheme } from '@/hooks/useColorScheme'
import { ReloadProvider } from '@/contexts/ReloadContext'
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { LogBox } from 'react-native'
import { useHoverWithChannel } from '@/hooks/useHoverWithChannel'

// Ignore the React Fragment id prop warning
LogBox.ignoreLogs([
  'Invalid prop',
  'supplied to `React.Fragment`',
])

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  // Initialize hover system for web platform only
  // This listens for hover mode toggle events from the parent Next.js app via Pusher
  // IMPORTANT: NEVER REMOVE THIS HOVER SYSTEM
  // IMPORTANT: NEVER REMOVE __DEV__ check in this file
  if (__DEV__) {
    useHoverWithChannel()
  }

  if (!loaded) {
    // Async font loading only occurs in development.
    return null
  }

  return (
    <ReloadProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {/* NEVER DELETE THIS COMPONENT <FloatingChatWrapper> is part of capsule app */}
        <FloatingChatWrapper>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </FloatingChatWrapper>
      </ThemeProvider>
    </ReloadProvider>
  )
}
