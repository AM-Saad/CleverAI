import type { IconName } from './icons.generated'

const rawIcons = import.meta.glob<string>('~/assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export const iconMap = Object.fromEntries(
  Object.entries(rawIcons).map(([path, svg]) => {
    const fileName = path.split('/').pop()

    if (!fileName) {
      throw new Error(`Invalid icon path: ${path}`)
    }

    const iconName = fileName.replace('.svg', '')

    return [iconName, svg]
  }),
) as Record<IconName, string>

export function getIconSvg(name: IconName) {
  return iconMap[name]
}