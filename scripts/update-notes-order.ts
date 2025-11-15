import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateNotesOrder() {
  try {
    console.log('🚀 Starting notes order update...\n')

    // Get all folders
    const folders = await prisma.folder.findMany({
      select: {
        id: true,
        title: true,
      },
    })

    console.log(`📁 Found ${folders.length} folders\n`)

    let totalNotesUpdated = 0

    for (const folder of folders) {
      // Get all notes for this folder (without order field initially to avoid null errors)
      const notes = await prisma.note.findMany({
        where: { folderId: folder.id },
        select: { id: true },
      })

      const notesCount = notes.length

      if (notesCount === 0) {
        console.log(`📂 Folder "${folder.title}" (${folder.id}) - No notes to update`)
        continue
      }

      console.log(`📂 Folder "${folder.title}" (${folder.id}) - ${notesCount} notes`)

      // Update each note with its order (starting from 0)
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i]
        await prisma.note.update({
          where: { id: note.id },
          data: { order: i },
        })
        console.log(`   ✓ Updated note ${note.id} - order: ${i}`)
      }

      totalNotesUpdated += notesCount
      console.log(`   ✅ Updated ${notesCount} notes in this folder\n`)
    }

    console.log(`\n✅ Complete! Updated ${totalNotesUpdated} notes across ${folders.length} folders`)
  } catch (error) {
    console.error('❌ Error updating notes order:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateNotesOrder()
