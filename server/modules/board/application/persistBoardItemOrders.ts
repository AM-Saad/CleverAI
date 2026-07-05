export interface BoardItemOrderWrite {
  id: string;
  order: number;
}

export interface PersistBoardItemOrdersInput {
  prisma: any;
  userId: string;
  itemOrders: BoardItemOrderWrite[];
  attempts?: number;
  missingItemError?: () => Error;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function isRetryableBoardOrderWrite(error: any): boolean {
  const msg = String(error?.message || error?.statusMessage || "");
  return /write conflict|deadlock|transaction already closed|transient transaction|timed out|timeout/i.test(msg);
}

export async function persistBoardItemOrders({
  prisma,
  userId,
  itemOrders,
  attempts = 4,
  missingItemError,
}: PersistBoardItemOrdersInput): Promise<void> {
  let lastError: any;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      for (const itemOrder of itemOrders) {
        const result = await prisma.boardItem.updateMany({
          where: { id: itemOrder.id, userId },
          data: { order: itemOrder.order },
        });

        if (result.count !== 1) {
          throw missingItemError?.() ?? new Error("Board item order target was not found");
        }
      }
      return;
    } catch (error: any) {
      if (error?.statusCode || !isRetryableBoardOrderWrite(error) || attempt === attempts - 1) {
        throw error;
      }

      lastError = error;
      await sleep(50 * Math.pow(2, attempt) + Math.floor(Math.random() * 30));
    }
  }

  throw lastError;
}
