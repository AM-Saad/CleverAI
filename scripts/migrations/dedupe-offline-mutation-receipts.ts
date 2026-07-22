import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

try {
  const receipts = await prisma.offlineMutationReceipt.findMany({
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof receipts>();
  for (const receipt of receipts) {
    const key = `${receipt.userId}:${receipt.mutationId}`;
    const rows = groups.get(key) ?? [];
    rows.push(receipt);
    groups.set(key, rows);
  }

  const duplicates = [...groups.values()].filter((rows) => rows.length > 1);
  const conflicting = duplicates.filter((rows) => {
    const canonical = JSON.stringify({
      status: rows[0]!.status,
      result: rows[0]!.result,
    });
    return rows.some(
      (row) =>
        JSON.stringify({ status: row.status, result: row.result }) !==
        canonical,
    );
  });
  const quarantined = duplicates.flatMap((rows) =>
    rows.slice(1).map((row) => ({
      id: row.id,
      mutationId: `duplicate:${row.id}:${row.mutationId}`,
    })),
  );

  console.log(
    JSON.stringify({
      duplicateKeys: duplicates.length,
      duplicateRows: quarantined.length,
      conflictingKeys: conflicting.length,
      mode: apply ? "apply" : "audit",
    }),
  );

  if (apply) {
    for (const row of quarantined) {
      await prisma.offlineMutationReceipt.update({
        where: { id: row.id },
        data: { mutationId: row.mutationId },
      });
    }
  }
} finally {
  await prisma.$disconnect();
}
