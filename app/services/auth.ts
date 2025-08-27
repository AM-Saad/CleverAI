/* eslint-disable no-console */
import { RESOURCES } from "~/utils/constants/resources.enum"

type MyExpectedResponseType = {
  message: string
  body: unknown
}
export interface AuthService {
  register_user: (data: {
    name?: string
    email: string
    password?: string
    confirmPassword?: string
    provider: string
  }) => Promise<MyExpectedResponseType>
  authenticate: (credentials: {
    email: string
    password: string
  }) => Promise<MyExpectedResponseType>
  verify: (email: string) => Promise<MyExpectedResponseType>
  register_passkey: (email: string) => Promise<MyExpectedResponseType>
  //   verify_register_passkey: (email: string, passkey: string) => Promise<MyExpectedResponseType>
}

export const AuthService: AuthService = {
  register_user: async (credentials: {
    name?: string
    email: string
    password?: string
    confirmPassword?: string
    provider: string
  }) => {
    const server = useRuntimeConfig().public.SERVER_URL

    try {
      const response = await fetch(server + RESOURCES.AUTH_REGISTER_USER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })
      const data = await response.json()
      console.log("register_user -> data", data)
      return data as Promise<MyExpectedResponseType>
    } catch (error) {
      console.error("Failed to register user:", error)
      throw new Error("Failed to register user")
    }
  },

  verify: async (email: string) => {
    const server = useRuntimeConfig().public.AUTH_ORIGIN
    try {
      const response = await fetch(`${server}${RESOURCES.AUTH_VERIFY_USER}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })
      console.log("verify -> response", response)
      return (await response.json()) as Promise<MyExpectedResponseType>
    } catch (error) {
      console.error("Failed to verify user:", error)
      throw new Error("Failed to verify user")
    }
  },

  authenticate: async (credentials: { email: string; password: string }) => {
    console.log("authenticate -> credentials", credentials)
    try {
      const response = await fetch(RESOURCES.AUTH_AUTHENTICATE_USER, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      })
      console.log("authenticate -> response", response)
      return response.json() as Promise<MyExpectedResponseType>
    } catch (error) {
      console.error("Failed to authorize:", error)
      throw new Error("Failed to authorize")
    }
  },

  register_passkey: async (email: string) => {
    try {
      const response = await fetch(RESOURCES.AUTH_REGISTER_PASSKEY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })
      return response.json() as Promise<MyExpectedResponseType>
    } catch (error) {
      console.error("Failed to register passkey:", error)
      throw new Error("Failed to register passkey")
    }
  },
}
