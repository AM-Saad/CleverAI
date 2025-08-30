import { requireRole } from "~/../server/middleware/auth"
import { ErrorFactory, ErrorType } from "~/services/ErrorFactory"

export default defineEventHandler(async (event) => {
    const user = await requireRole(event, ["USER"])
    const prisma = event.context.prisma

    try {
        const folders = await prisma.folder.findMany({
            where: { userId: user.id },
            include: {
                materials: true,
                flashcards: true,
                questions: true,
            },
            orderBy: { order: 'asc' },
        })
        return folders
    } catch (error) {
        console.error("Error fetching folders:", error)
        throw ErrorFactory.create(
            ErrorType.Validation,
            "Folders",
            "Failed to fetch folders",
        )
    }
})
