export enum RESOURCES {
  AUTH_REGISTER_USER = "/api/auth/register",
  // AUTH_AUTHENTICATE_USER = "/api/auth/authenticate", // REMOVED: Unused endpoint
  // AUTH_VERIFY_USER = "/api/auth/find", // REMOVED: Unused endpoint
  AUTH_REGISTER_PASSKEY = "/api/auth/passkeys/register",
  AUTH_AUTHENTICATE_PASSKEY = "/api/auth/passkeys/authenticate",
  AUTH_VERIFY_REGISTER_PASSKEY = "/api/auth/passkeys/register/verify",
  AUTH_VERIFY_AUTHENTICATE_PASSKEY = "/api/auth/passkeys/authenticate/verify",
  AUTH_VERIFICATION = "/api/auth/verification",
  AUTH_VERIFICATION_VERIFY = "/api/auth/verification/verify",
  AUTH_FORGOT_PASSWORD = "/api/auth/password/forgot",
  AUTH_FORGOT_VERIFY = "/api/auth/password/verify",
  FOLDERS = "/api/folders",
}
