// server/api/debug.get.ts
export default defineEventHandler(async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    take: 10,
  });

  console.log("Debug endpoint accessed. Sample users:", users);
  return {
    message: "Debug endpoint is working",
    sampleUsers: users,
  };
});
