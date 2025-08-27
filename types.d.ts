declare module "web-push"
declare module "nuxt-auth"
declare module "socket.io-client"
declare module "bcryptjs"
interface Window {
  camStream?: MediaStream
  broadcast?: MediaStream
  mediaCamRecorder: MediaRecorder
  screenStream?: MediaStream
  audioCtx?: AudioContext
}

// extend tha blob interface to add chunks and name properties
declare interface Blob {
  chunks: BlobPart[]
  name: string
}
