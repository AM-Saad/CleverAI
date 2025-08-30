import { defineAppConfig } from "nuxt/app";

export default defineAppConfig({
    name: 'cleverAI',
    description: 'A powerful AI assistant for your daily tasks.',
  ui: {
        theme: { colors: ['primary','secondary','tertiary','info','success','warning','error'] },
    // map semantic aliases to Tailwind palette names (or to your @theme colors)
    colors: {
      primary: 'green',   // uses your @theme green-* shades
      neutral: 'zinc'
    },

    // global defaults per component
    input: {
      // your repo already did this correctly
      variant: {
        outline: 'shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white ring-1 ring-inset ring-green-300 focus:ring-2 focus:ring-green-500'
      },
      default: { variant: 'outline', color: 'white', size: 'md' }
    },

    button: {
      default: { color: 'primary', variant: 'solid', size: 'md' },
      base: 'font-semibold rounded-md'
    }
  },
  theme: {
    primaryColor: 'green'
  }
})
