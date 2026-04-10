export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'slate'
    },
    toaster: {
      slots: {
        // viewport: "fixed flex flex-col w-[calc(100%-2rem)] sm:w-96 z-[100] data-[expanded=true]:h-(--height) focus:outline-none",
        base: `pointer-events-auto bg-white border-0 ring-0 rounded-[var(--radius-2xl)] p-3 px-8 absolute  z-(--index) transform-(--transform) 
        data-[expanded=false]:data-[front=false]:h-(--front-height) data-[expanded=false]:data-[front=false]:*:opacity-0 
        data-[front=false]:*:transition-opacity data-[front=false]:*:duration-100 data-[state=closed]:animate-[toast-closed_200ms_ease-in-out] 
        data-[state=closed]:data-[expanded=false]:data-[front=false]:animate-[toast-collapsed-closed_200ms_ease-in-out] 
        data-[swipe=move]:transition-none transition-[transform,translate,height] duration-200 ease-out shadow-xl`
      },
      // compoundVariants: [
      //   {
      //     position: [
      //       "top-left",
      //       "top-center",
      //       "top-right"
      //     ],
      //     class: {
      //       base: " data-[state=open]:animate-[slide-in-from-top_200ms_ease-in-out]"
      //     }
      //   },
      //   {
      //     position: [
      //       "bottom-left",
      //       "bottom-center",
      //       "bottom-right"
      //     ],
      //     class: {
      //       viewport: "bottom-10 lg:bottom-8",
      //       base: "bottom-0 data-[state=open]:animate-[slide-in-from-bottom_600ms_ease-in-out]"
      //     }
      //   }
      // ],
      // defaultVariants: {
      //   position: "top-right",
      //   swipeDirection: "bottom"
      // }
    },
    toast: {
      slots: {
        title: "text-content-on-surface",
        description: "text-content-secondary",
        progress: 'w-10/12 inset-x-auto'
      }
    },
    input: {
      slots: {
        base: "focus:border-primary focus:ring-1 focus:ring-primary/90! focus:outline-0 focus-visible:outline-0 focus-visible:ring-0 ring-secondary! rounded-[var(--radius-lg)] text-content-on-surface!",
      }
    },
    textarea: {
      slots: {
        base: "focus:border-primary focus:ring-1 focus:ring-primary/90! focus:outline-0 focus-visible:outline-0 focus-visible:ring-0 ring-secondary! rounded-[var(--radius-lg)] text-content-on-surface!",
      }
    },
    formField: {
      slots: {
        label: 'text-sm text-content-on-surface'
      }
    },
    button: {
      slots: {
        base: 'rounded-[var(--radius-lg)]'
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'solid',
          class: 'text-on-primary'
        },
        {
          color: 'error',
          variant: 'solid',
          class: 'text-white'
        },
        {
          color: 'error',
          variant: 'ghost',
          class: 'text-error'
        },

      ],
    },
    dropdownMenu: {
      slots: {
        content: 'bg-white ring-0 border border-secondary',
        item: 'items-center',
        itemLabel: 'text-content-on-surface',
        itemLeadingIcon: 'text-content-on-surface!',
      },
      variants: {
        active: {
          false: {
            item: 'data-highlighted:before:bg-surface-strong data-[state=open]:before:bg-surface-strong'
          },
          true: {
            item: 'before:bg-surface-strong'
          }
        }
      }
    },
    contextMenu: {
      slots: {
        content: 'bg-surface ring-0 border border-secondary',
        item: 'items-center',
        itemLabel: 'text-content-on-surface',
        itemLeadingIcon: 'text-content-on-surface!',

      },
      variants: {
        active: {
          false: {
            item: 'data-highlighted:before:bg-surface data-[state=open]:before:bg-surface'
          },
          true: {
            item: 'before:bg-surface'
          }
        }
      }
    }
  }
})