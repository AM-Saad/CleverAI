// server/plugins/srEngine.ts

import { DefaultSREngine } from "@/domain/sr/SREngine";
import { Sm2Scheduler } from "@/domain/sr/SRScheduler";

import { PrismaCardReviewRepository } from "@/domain/repositories/PrismaCardReviewRepository";
import { PrismaCardRepository } from "@/domain/repositories/PrismaCardRepository";

export default defineNitroPlugin((nitroApp) => {
  const scheduler = new Sm2Scheduler();
  const reviews = new PrismaCardReviewRepository();
  const cards = new PrismaCardRepository();
  const engine = new DefaultSREngine({ reviews, cards, scheduler });

  nitroApp.hooks.hook("request", (event) => {
    // Make available as event.context.srEngine
    event.context.srEngine = engine;
  });
});

// Type augmentation so event.context.srEngine is typed
declare module "h3" {
  interface H3EventContext {
    srEngine: DefaultSREngine;
  }
}
