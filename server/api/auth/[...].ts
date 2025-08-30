/* eslint-disable no-console */
// file: ~/../server/api/auth/[...].ts
import GoogleProvider from "next-auth/providers/google"
import { NuxtAuthHandler } from "#auth"
import { AuthService } from "~/services/auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { verificationCode } from "~/utils/verificationCode.server"
const prisma = new PrismaClient()
const config = useRuntimeConfig()

export default NuxtAuthHandler({
  secret: config.AUTH_SECRET,
  debug: true,
  providers: [
    // @ts-expect-error Use .default here for it to work during SSR.
    GoogleProvider.default({
      clientId: config.public.GOOGLE_CLIENT_ID,
      clientSecret: config.public.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline", // Needed to get `refresh_token`
          include_granted_scopes: true,
        },
      },
    }),
    // @ts-expect-error Use .default here for it to work during SSR.
    CredentialsProvider.default({
      name: "Credentials",
      credentials: {
        email: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: {
        email: string
        password: string
      }): Promise<unknown> {
        // Add logic to verify credentials here
        if (!credentials) {
          //  throw new Error("Invalid Credentials - Email Not Provided")
          return null
        }
        const { email, password } = credentials
        // Fetch user and password hash from your database
        const user = await prisma.user.findUnique({ where: { email },
            include:{
            subscription: true,
            folders: true,
        } })
        console.log("authorize -> user exist", user?.email)
        if (!user) {
          throw new Error("Invalid Credentials - User Not Found")
        }

        if (!user.email_verified) {
          throw new Error(
            `Account not verified, click <a class='font-bold' href='/auth/verifyAccount?email=${email}'>here</a> to verify your account`,
          )
        }

        if (!user.password) {
          const newVerificationCode = await verificationCode()


          await prisma.user.update({
            where: { email },
            data: {
              password_verification: newVerificationCode,
            },
          })
          throw new Error(
            `Invalid Credentials - Password not set up.  <br/> Please use the provider to login or create a password from <a class='font-bold' href='/auth/editPassword?newPassword=true'>here</a>`,
          )
        }

        // Compare the provided password with the hashed password from the database

        const valid = await bcrypt.compare(password, user.password)
        console.log("authorize -> valid", valid)
        if (!valid) {
          throw new Error("Invalid Credentials - Password Incorrect")
        }
        // If the password is valid, return the user object
        console.log("authorize -> user", user.email)
        return user
      },
    }),
  ],

  pages: {
    signIn: "/auth/signIn",
    //  error: "/auth/signIn",
    verifyRequest: "/auth/verify-request",
    newUser: "/auth/new-user",
  },
  events: {
    signIn: async (params) => {
      console.log("Event -> signIn", params.user)
      const { email, name } = params.user
      if (params.account && params.account.provider === "google" && email) {
        try {
          const user = await prisma.user.findFirst({
            where: {
              email,
            },
          })
          if (!user) {
            await AuthService.register_user({
              name: name || email,
              email: email,
              provider: "google",
            })
          }
        } catch (error) {
          console.error("Failed to verify user:", error)
        }
      }
      if (params.profile && params.isNewUser && email) {
        await AuthService.register_user({
          name: name || email,
          email: email,
          provider: "google",
        })
      }
      console.log("Event -> signIn", params.user.email)
    },
    signOut: async (message): Promise<void> => {
      console.log("signOut", message)
    },
  },
  callbacks: {
    async signIn({ user }) {
      console.log("callbacks -> signIn -> user", user)
      if (!user) {
        return "/auth/error?error=UserNotFound" // Redirect to error page
      }
      return true // Proceed with login
    },

    async jwt({ token, user, account }) {
      console.log("callbacks -> jwt -> user", user)
      // Google OAuth: add Google-specific fields
      if (account && account.provider === "google") {
        token.access_token = account.access_token
        token.expires_at =
          Math.floor(Date.now() / 1000) + (account.expires_at || 0)
        token.refresh_token = account.refresh_token ?? token.refresh_token
        token.provider = "google"
        token.userRole = "Admin"
      }
      // Credentials login: add user fields
      if (user) {
        token.id = user.id
        token.name = user.name
        // token.subscription = user.subscription
        token.email = user.email ?? undefined
        if ("role" in user && user.role) token.role = user.role
        token.provider = account?.provider || "credentials"
      }
      // Fetch from DB if missing
      if (
        (!token.role || !token.grade) &&
        token.email &&
        typeof token.email === "string"
      ) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email },
            include: {
              subscription: true,
              folders: true,
            },
          })
          if (dbUser) {
            token.id = dbUser.id
            token.name = dbUser.name
            token.subscription = dbUser.subscription
            if (dbUser.role) token.role = dbUser.role
          }
        } catch (e) {
          console.error("JWT callback DB fetch error", e)
        }
      }
      console.log("callbacks -> jwt -> token", token)
      return token
    },

    async session({ session, token }) {
      console.log("session callback - session:", session)
      console.log("session callback - token:", token)
      // Merge token fields into session
      return {
        ...session,
        provider: token.provider,
        user: {
          ...token,
        },
      }
    },

    //  async signIn(params) {
    //    console.log("callback signIn -> params", params)
    //    return true
    //    // const profile = params.profile as GoogleProfile
    //    // const account = params.account as Account
    //    // const email = params.email as { verificationRequest: boolean }
    //    // console.log("callback signIn -> account", account)
    //    // console.log("callback signIn -> profile", profile)
    //    // if (account && account.provider === "google") {
    //    //   console.log(
    //    //     "callback signIn -> account -> email_verified",
    //    //     profile.email_verified,
    //    //   )
    //    //   //   return profile && profile.email_verified
    //    // }
    //    // return true // Do different verification for other providers that don't have `email_verified`
    //  },
  },
})
