import 'auth.js'

declare module 'auth.js' {
  interface User {
    role?: string
    grade?: string
    // Add any other custom fields here
  }

  interface Session {
    user?: User
    // Add any other custom fields here
  }
}
