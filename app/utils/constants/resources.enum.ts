export enum RESOURCES {
  AUTH_REGISTER_USER = "/api/auth/register",
  AUTH_AUTHENTICATE_USER = "/api/auth/authenticate",
  AUTH_VERIFY_USER = "/api/auth/find",
  AUTH_REGISTER_PASSKEY = "/api/passkeys/register",
  AUTH_AUTHENTICATE_PASSKEY = "/api/passkeys/authenticate",
  AUTH_VERIFY_REGISTER_PASSKEY = "/api/passkeys/register/verify",
  AUTH_VERIFY_AUTHENTICATE_PASSKEY = "/api/passkeys/authenticate/verify",
  AUTH_VERIFICATION = "/api/verification",
  AUTH_VERIFICATION_VERIFY = "/api/verification/verify",
  AUTH_FORGOT_PASSWORD = "/api/password/forgot",
  AUTH_FORGOT_VERIFY = "/api/password/verify",
  FOLDERS = "/api/folders",

}
