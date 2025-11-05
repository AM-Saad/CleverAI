export default defineAppConfig({
  theme: {
    radius: 0.25,
    blackAsPrimary: false
  },
  ui: {
    colors: {
      primary: 'green',
      neutral: 'slate'
    },
    toaster: {
      slots:{
        viewport: "fixed flex flex-col w-[calc(100%-2rem)] sm:w-96 z-[100] data-[expanded=true]:h-(--height) focus:outline-none",
        base: `pointer-events-auto bg-light border-0 ring-0 rounded-full p-4 absolute inset-x-0 z-(--index) transform-(--transform) 
        data-[expanded=false]:data-[front=false]:h-(--front-height) data-[expanded=false]:data-[front=false]:*:opacity-0 
        data-[front=false]:*:transition-opacity data-[front=false]:*:duration-100 data-[state=closed]:animate-[toast-closed_200ms_ease-in-out] 
        data-[state=closed]:data-[expanded=false]:data-[front=false]:animate-[toast-collapsed-closed_200ms_ease-in-out] 
        data-[swipe=move]:transition-none transition-[transform,translate,height] duration-200 ease-out`
      },
      compoundVariants:[
        {
          position: [
            "top-left",
            "top-center",
            "top-right"
          ],
          class: {
            viewport: "top-4",
            base: "top-0 data-[state=open]:animate-[slide-in-from-top_200ms_ease-in-out]"
          }
        },
        {
          position: [
            "bottom-left",
            "bottom-center",
            "bottom-right"
          ],
          class: {
            viewport: "bottom-4",
            base: "bottom-0 data-[state=open]:animate-[slide-in-from-bottom_200ms_ease-in-out]"
          }
        }
      ],
      defaultVariants:{
        position: "bottom-center",
        swipeDirection: "bottom"
      }
    },
  }
})