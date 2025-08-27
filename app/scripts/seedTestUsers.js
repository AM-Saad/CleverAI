import { PrismaClient } from '@prisma/client'
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main(){
  // Teacher
  const hashedPassword = await bcrypt.hash("bodakaka", 10)
  const teacher = await prisma.user.upsert({
    where: { email: 'user@shater.com' },
    update: {},
    create: {
      name: 'Test User',
      email: 'user@shater.com',
      password: hashedPassword,
      phone: '1234567890',
      gender: 'M',
      auth_provider: 'credentials',
      account_verified: true,
      email_verified: true,
      role:'User'
    },
  })

  console.log('Seeded test users:', { teacher })
}

main().finally(() => prisma.$disconnect())
