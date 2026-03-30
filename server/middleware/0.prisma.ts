// server/middleware/0.prisma.ts
//
// Attach the shared Prisma singleton to every request context so that
// handlers can use either `event.context.prisma` or the auto-imported
// `prisma` — both point to the exact same PrismaClient instance and
// therefore share a single connection pool.
import { prisma } from "../utils/prisma";

declare module "h3" {
  interface H3EventContext {
    prisma: typeof prisma;
  }
}

export default eventHandler((event) => {
  event.context.prisma = prisma;
});
