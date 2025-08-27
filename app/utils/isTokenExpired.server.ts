// Code: utils/isTokenExpired.server.ts
import type jwt from "jsonwebtoken"

export const isTokenExpired = (token: jwt.JwtPayload): boolean => {
  if (!token) return true
  let isExpiredToken = false

  const dateNow = new Date()

  if (token.exp && token.exp < dateNow.getTime() / 1000) {
    isExpiredToken = true
  }

  return isExpiredToken
}
