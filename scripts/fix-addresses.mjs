import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const rows = await prisma.property.findMany()
const broken = rows.filter((row) => row.address.includes('?'))
for (const row of broken) {
  await prisma.property.update({
    where: { id: row.id },
    data: { address: 'ركن الدين، دمشق' },
  })
}
console.log('fixed', broken.length)
await prisma.$disconnect()
