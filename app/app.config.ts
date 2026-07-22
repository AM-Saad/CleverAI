const buttonStateVariants = [
  { color: "primary", variant: "solid", class: "bg-primary! text-on-primary! hover:bg-primary-hover! active:bg-primary-active!" },
  { color: "neutral", variant: "solid", class: "bg-surface-strong! text-content-on-surface-strong! hover:bg-border-strong! active:bg-border-strong!" },
  { color: "error", variant: "solid", class: "bg-error! text-on-error! hover:bg-error/85! active:bg-error/75!" },

  { color: "primary", variant: "soft", class: "bg-primary/10! text-primary! hover:bg-primary/15! active:bg-primary/20!" },
  { color: "neutral", variant: "soft", class: "bg-surface-subtle! text-content-on-surface! hover:bg-surface-strong! active:bg-border-strong!" },
  { color: "error", variant: "soft", class: "bg-error/10! text-error-text! hover:bg-error/15! active:bg-error/20!" },

  { color: "primary", variant: "ghost", class: "bg-transparent! text-primary! hover:bg-primary/10! active:bg-primary/15!" },
  { color: "neutral", variant: "ghost", class: "bg-transparent! text-content-secondary! hover:bg-surface-subtle! hover:text-content-on-surface! active:bg-surface-strong!" },
  { color: "error", variant: "ghost", class: "bg-transparent! text-error-text! hover:bg-error/10! active:bg-error/15!" },

  { color: "primary", variant: "link", class: "bg-transparent! p-0! text-primary! hover:underline! active:opacity-70!" },
  { color: "neutral", variant: "link", class: "bg-transparent! p-0! text-content-secondary! hover:underline! active:opacity-70!" },
  { color: "error", variant: "link", class: "bg-transparent! p-0! text-error-text! hover:underline! active:opacity-70!" },
] as const;

const fieldVariants = {
  outline: "bg-surface! ring-1! ring-inset ring-secondary!",
} as const;

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      neutral: 'secondary'
    },
    toaster: {
      slots: {
        // viewport: "fixed flex flex-col w-[calc(100%-2rem)] sm:w-96 z-[100] data-[expanded=true]:h-(--height) focus:outline-none",
        base: `pointer-events-auto bg-surface text-content-on-surface border-0 ring-0 rounded-[var(--radius-2xl)] p-3 px-8 absolute  z-(--index) transform-(--transform)
        data-[expanded=false]:data-[front=false]:h-(--front-height) data-[expanded=false]:data-[front=false]:*:opacity-0
        data-[front=false]:*:transition-opacity data-[front=false]:*:duration-100 data-[state=closed]:animate-[toast-closed_200ms_ease-in-out]
        data-[state=closed]:data-[expanded=false]:data-[front=false]:animate-[toast-collapsed-closed_200ms_ease-in-out]
        data-[swipe=move]:transition-none transition-[transform,translate,height] duration-200 ease-out shadow-[var(--component-toast-shadow)]`
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
        base: "text-content-on-surface! placeholder:text-content-disabled! rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-60! focus:outline-none focus-visible:outline-none focus:ring-2! focus:ring-inset focus:ring-[var(--ds-focus-outline-color)]! focus-visible:ring-2! focus-visible:ring-inset focus-visible:ring-[var(--ds-focus-outline-color)]! transition-[background-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        leadingIcon: "text-content-secondary!",
        trailingIcon: "text-content-secondary!",
      },
      variants: {
        variant: fieldVariants,
      },
    },
    textarea: {
      slots: {
        base: "text-content-on-surface! placeholder:text-content-disabled! rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-60! focus:outline-none focus-visible:outline-none focus:ring-2! focus:ring-inset focus:ring-[var(--ds-focus-outline-color)]! focus-visible:ring-2! focus-visible:ring-inset focus-visible:ring-[var(--ds-focus-outline-color)]! transition-[background-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        leadingIcon: "text-content-secondary!",
        trailingIcon: "text-content-secondary!",
      },
      variants: {
        variant: fieldVariants,
      },
    },
    select: {
      slots: {
        base: "text-content-on-surface! rounded-[var(--radius-lg)] disabled:cursor-not-allowed disabled:opacity-60! focus:outline-none focus:ring-2! focus:ring-inset focus:ring-[var(--ds-focus-outline-color)]! transition-[background-color,box-shadow,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        placeholder: "text-content-disabled!",
        leadingIcon: "text-content-secondary!",
        trailingIcon: "text-content-secondary!",
        content: "bg-surface border border-secondary shadow-[var(--shadow-dropdown)] rounded-[var(--radius-lg)] ring-0",
        viewport: "divide-y divide-secondary",
        group: "p-1",
        label: "text-content-on-surface-strong",
        separator: "bg-secondary",
        item: "text-content-on-surface data-highlighted:not-data-disabled:text-content-on-surface-strong data-highlighted:not-data-disabled:before:bg-surface-strong data-disabled:cursor-not-allowed data-disabled:opacity-60",
        itemLeadingIcon: "text-content-secondary group-data-highlighted:not-group-data-disabled:text-content-on-surface",
        itemDescription: "text-content-secondary",
      },
      variants: {
        variant: fieldVariants,
      },
    },
    checkbox: {
      slots: {
        base: "rounded-[var(--radius-sm)] ring-1 ring-inset ring-secondary focus-visible:outline-2! focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ds-focus-outline-color)]!",
        indicator: "text-on-primary",
        label: "text-content-on-surface",
        description: "text-content-secondary",
      },
      variants: {
        color: {
          primary: { base: "focus-visible:outline-[var(--ds-focus-outline-color)]!", indicator: "bg-primary" },
          error: { base: "focus-visible:outline-[var(--ds-focus-outline-color)]!", indicator: "bg-error text-on-error" },
        },
        variant: {
          list: { root: "" },
        },
        disabled: {
          true: {
            root: "opacity-60!",
            base: "cursor-not-allowed",
            label: "cursor-not-allowed",
            description: "cursor-not-allowed",
          },
        },
      },
    },
    switch: {
      slots: {
        base: "border-2 border-transparent focus-visible:outline-2! focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ds-focus-outline-color)]! data-[state=unchecked]:bg-surface-strong transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        thumb: "bg-surface shadow-[var(--shadow-dropdown)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        label: "text-content-on-surface",
        description: "text-content-secondary",
      },
      variants: {
        color: {
          primary: { base: "data-[state=checked]:bg-primary focus-visible:outline-[var(--ds-focus-outline-color)]!", icon: "group-data-[state=checked]:text-primary" },
          error: { base: "data-[state=checked]:bg-error focus-visible:outline-[var(--ds-focus-outline-color)]!", icon: "group-data-[state=checked]:text-error-text" },
        },
        disabled: {
          true: {
            root: "opacity-60!",
            base: "cursor-not-allowed",
            label: "cursor-not-allowed",
            description: "cursor-not-allowed",
          },
        },
      },
    },
    formField: {
      slots: {
        label: 'text-sm text-content-on-surface',
        description: 'text-content-secondary',
        hint: 'text-content-secondary',
        help: 'text-content-secondary',
        error: 'text-error-text',
      }
    },
    button: {
      slots: {
        base: 'rounded-[var(--radius-lg)] cursor-pointer focus-visible:ring-0! focus-visible:outline-2! focus-visible:outline-offset-[-2px]! focus-visible:outline-[var(--ds-focus-outline-color)]! disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60! aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60! active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
      },
      compoundVariants: [...buttonStateVariants],
    },
    dropdownMenu: {
      slots: {
        content: 'bg-surface ring-0 border border-secondary z-50 shadow-[var(--shadow-dropdown)] rounded-[var(--radius-lg)]',
        viewport: 'divide-y divide-secondary',
        separator: 'bg-secondary',
        item: 'items-center shrink-0 text-content-on-surface data-disabled:cursor-not-allowed data-disabled:opacity-60 data-highlighted:before:bg-surface-strong data-[state=open]:before:bg-surface-strong',
        itemLabel: 'text-content-on-surface',
        itemDescription: 'text-content-secondary',
        itemLeadingIcon: 'text-content-secondary! group-data-highlighted:text-content-on-surface!',
      },
      variants: {
        active: {
          false: {
            item: 'data-highlighted:before:bg-surface-strong data-[state=open]:before:bg-surface-strong'
          },
          true: {
            item: 'before:bg-surface-strong text-content-on-surface-strong'
          }
        }
      },
      compoundVariants: [
        { color: 'primary', active: false, class: { item: 'text-primary data-highlighted:text-primary data-highlighted:before:bg-primary/10', itemLeadingIcon: 'text-primary/80 group-data-highlighted:text-primary' } },
        { color: 'neutral', active: false, class: { item: 'text-content-on-surface data-highlighted:text-content-on-surface-strong data-highlighted:before:bg-surface-strong', itemLeadingIcon: 'text-content-secondary group-data-highlighted:text-content-on-surface' } },
        { color: 'success', active: false, class: { item: 'text-success-text data-highlighted:text-success-text data-highlighted:before:bg-success/10', itemLeadingIcon: 'text-success-text/80 group-data-highlighted:text-success-text' } },
        { color: 'warning', active: false, class: { item: 'text-warning-text data-highlighted:text-warning-text data-highlighted:before:bg-warning/10', itemLeadingIcon: 'text-warning-text/80 group-data-highlighted:text-warning-text' } },
        { color: 'error', active: false, class: { item: 'text-error-text data-highlighted:text-error-text data-highlighted:before:bg-error/10', itemLeadingIcon: 'text-error-text/80 group-data-highlighted:text-error-text' } },
        { color: 'info', active: false, class: { item: 'text-info-text data-highlighted:text-info-text data-highlighted:before:bg-info/10', itemLeadingIcon: 'text-info-text/80 group-data-highlighted:text-info-text' } },
        { color: 'primary', active: true, class: { item: 'text-primary before:bg-primary/10', itemLeadingIcon: 'text-primary' } },
        { color: 'neutral', active: true, class: { item: 'text-content-on-surface-strong before:bg-surface-strong', itemLeadingIcon: 'text-content-on-surface' } },
        { color: 'success', active: true, class: { item: 'text-success-text before:bg-success/10', itemLeadingIcon: 'text-success-text' } },
        { color: 'warning', active: true, class: { item: 'text-warning-text before:bg-warning/10', itemLeadingIcon: 'text-warning-text' } },
        { color: 'error', active: true, class: { item: 'text-error-text before:bg-error/10', itemLeadingIcon: 'text-error-text' } },
        { color: 'info', active: true, class: { item: 'text-info-text before:bg-info/10', itemLeadingIcon: 'text-info-text' } },
      ],
    },
    contextMenu: {
      slots: {
        content: 'bg-surface ring-0 border border-secondary z-50',
        item: 'items-center data-disabled:cursor-not-allowed data-disabled:opacity-60',
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
    },
    popover: {
      slots: {
        content: 'bg-surface border border-secondary shadow-[var(--shadow-dropdown)] rounded-[var(--radius-lg)] ring-0 focus:outline-none',
        arrow: 'fill-surface',
      },
    }
  }
})
