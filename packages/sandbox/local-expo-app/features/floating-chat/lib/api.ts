import { fetch as expoFetch } from 'expo/fetch'

export const generateAPIUrl = (relativePath: string) => {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://www.reactnativevibecode.com'
  return baseUrl.concat(path)
}

// Fetch that includes the project ID header for authentication
export const projectFetch = async (
  input: RequestInfo | URL,
  projectId: string,
  init?: RequestInit,
): Promise<Response> => {
  const headers = new Headers(init?.headers || {})
  headers.set('x-project-id', projectId)

  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url

  const fetchOptions: any = {
    ...init,
    headers,
  }

  // expo/fetch doesn't accept null body
  if (fetchOptions.body === null) {
    delete fetchOptions.body
  }

  return await expoFetch(url, fetchOptions)
}
