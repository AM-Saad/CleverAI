<template>
  <div v-if="editor" class="container flex relative h-full">
    <!-- Group: History -->

    <div
      class="sticky top-10 left-1 toolbar-groups flex flex-col gap-4 rounded bg-light shadow-md z-10 text-light h-fit">
      <!-- Group: Formatting -->

      <!-- Group: Headings -->
      <div class="group headings mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="headingsItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

      <!-- Group: Blocks -->
      <div class="group blocks mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="blocksItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

      <!-- Group: Lists -->
      <div class="group lists mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="listsItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

      <!-- Group: Tasks -->
      <div class="group tasks mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="tasksItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

      <!-- Group: Insert -->
      <div class="group insert mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="insertItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

      <!-- Group: Colors -->
      <div class="group colors mb-2">
        <UNavigationMenu trailing-icon="i-lucide-chevron-down" :items="colorsItems" collapsed :popover="true"
          orientation="vertical" class="w-full text-sm" tabindex="0" role="button" aria-haspopup="menu" />
      </div>

    </div>


    <div class="flex flex-col w-full">
      <div class="button-group flex gap-2 my-2 self-end">
        <u-button class="shrink-0" size="sm" @click="editor!.chain().focus().undo().run()"
          :disabled="!editor!.can().chain().focus().undo().run()" icon="i-lucide-undo"></u-button>

        <u-button class="shrink-0" size="sm" @click="editor!.chain().focus().redo().run()"
          :disabled="!editor!.can().chain().focus().redo().run()" icon="i-lucide-redo"></u-button>

        <!-- Selection test buttons -->
        <!-- <u-button class="shrink-0" size="sm" @click="handleGetSelection">Get Sel</u-button> -->
        <!-- <u-button class="shrink-0" size="sm" @click="handleSaveSelection">Save Sel</u-button> -->

        <!-- Marker demo: insert a persistent token and restore it after reload -->
        <!-- <u-button class="shrink-0" size="sm" @click="insertSelectionMarker">Insert Marker</u-button> -->
      </div>
      <UContextMenu :items="[
        // { label: 'Edit', onSelect: () => editNote(note) },
        {
          label: 'Add To Material', onSelect: () => {
            const selectedText = getSelectedText();
            if (selectedText) {
              emit('addToMaterial', selectedText);
            }

          }
        }
      ]">
        <editor-content :editor="editor" class="flex-1 pl-4" />
      </UContextMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Editor as TipTapEditor } from '@tiptap/core'
import { Selection } from 'prosemirror-state'
import type { Selection as PMSelection, SelectionBookmark } from 'prosemirror-state'
import Document from '@tiptap/extension-document'
import { ListItem, TaskItem, TaskList } from '@tiptap/extension-list'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
// note: explicit Dropcursor intentionally omitted to avoid duplicate warnings
import { Editor, EditorContent } from '@tiptap/vue-3'
import { initCollaboration } from '@/utils/'

// ---------- Types ----------
type CollaborationHandle = {
  ydoc?: unknown
  provider?: { destroy?: () => void; disconnect?: () => void; }
  collaborationExtension?: unknown
  cursorExtension?: unknown
  cleanup?: () => Promise<void>
  [k: string]: any
} | null

// ---------- Custom nodes ----------
const CustomDocument = Document.extend({
  content: 'block+',
})

const CustomTaskItem = TaskItem.extend({
  content: 'paragraph block*',
})

// ---------- reactive refs ----------
const editor = ref<TipTapEditor | null>(null)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'addToMaterial', value: string): void
}>()
const collaborationHandle = ref<CollaborationHandle>(null)
const props = defineProps<{
  modelValue: string
}>()

// store the last saved selection text (for quick access)
const savedSelectionText = ref<string | null>(null)
// bookmark to track selection across local transactions
let savedBookmark: SelectionBookmark | null = null

// helper: map savedBookmark on each transaction so it stays valid across edits
function attachBookmarkTracker() {
  if (!editor.value) return
  try {
    editor.value.on('transaction', ({ transaction }) => {
      if (!savedBookmark) return
      try {
        // bookmark.map exists on the object returned by getBookmark()
        savedBookmark = savedBookmark.map(transaction.mapping)
      } catch (e) {
        // mapping failed; clear bookmark
        savedBookmark = null
      }
    })
  } catch (e) { /* ignore */ }
}

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const current = editor.value.getHTML();
    if (current === value) return;
    editor.value.commands.setContent(value || "");
  },
  { immediate: true },
);

// --- Navigation menu items used as replacements for <details> ---
const headingsItems = ref<NavigationMenuItem[]>([
  {
    label: 'Headings',
    icon: 'i-lucide-type',
    children: [
      { label: 'Paragraph', icon: 'i-lucide-text', description: 'Set paragraph', onSelect: () => editor.value!.chain().focus().setParagraph().run() },
      { label: 'H1', icon: 'i-lucide-hash', description: 'Heading level 1', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: 'H2', icon: 'i-lucide-hash', description: 'Heading level 2', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: 'H3', icon: 'i-lucide-hash', description: 'Heading level 3', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 3 }).run() },
      { label: 'H4', icon: 'i-lucide-hash', description: 'Heading level 4', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 4 }).run() },
      { label: 'H5', icon: 'i-lucide-hash', description: 'Heading level 5', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 5 }).run() },
      { label: 'H6', icon: 'i-lucide-hash', description: 'Heading level 6', onSelect: () => editor.value!.chain().focus().toggleHeading({ level: 6 }).run() },
      { label: 'Bold', icon: 'i-lucide-bold', description: 'Toggle bold text', onSelect: () => editor.value!.chain().focus().toggleBold().run() },
      { label: 'Italic', icon: 'i-lucide-italic', description: 'Toggle italic text', onSelect: () => editor.value!.chain().focus().toggleItalic().run() },
      { label: 'Strike', icon: 'i-lucide-strikethrough', description: 'Toggle strikethrough text', onSelect: () => editor.value!.chain().focus().toggleStrike().run() }
    ]
  }
])

const tasksItems = ref<NavigationMenuItem[]>([
  {
    label: 'Tasks',
    icon: 'i-lucide-list-check',
    children: [
      { label: 'Toggle Todo List', icon: 'i-lucide-list-check', description: 'Turn todo list on/off', onSelect: () => editor.value!.chain().focus().toggleTaskList().run() },
      { label: 'Add Task Item', icon: 'i-lucide-plus', description: 'Insert a new task item', onSelect: () => addTaskItem() },
      { label: 'Toggle Complete', icon: 'i-lucide-check', description: 'Toggle checked state', onSelect: () => toggleTaskItem() },
      { label: 'Indent Task', icon: 'i-lucide-indent', description: 'Indent current task', onSelect: () => editor.value!.chain().focus().sinkListItem('taskItem').run() },
      { label: 'Outdent Task', icon: 'i-lucide-outdent', description: 'Outdent current task', onSelect: () => editor.value!.chain().focus().liftListItem('taskItem').run() }
    ]
  }
])

const blocksItems = ref<NavigationMenuItem[]>([
  {
    label: 'Blocks',
    icon: 'i-lucide-layout',
    children: [
      { label: 'Code block', icon: 'i-lucide-code', description: 'Insert or toggle code block', onSelect: () => editor.value!.chain().focus().toggleCodeBlock().run() },
      { label: 'Blockquote', icon: 'i-lucide-quote', description: 'Toggle blockquote', onSelect: () => editor.value!.chain().focus().toggleBlockquote().run() },
      { label: 'Horizontal rule', icon: 'i-lucide-minus', description: 'Insert horizontal rule', onSelect: () => editor.value!.chain().focus().setHorizontalRule().run() },
      { label: 'Hard break', icon: 'i-lucide-corner-down-right', description: 'Insert hard break', onSelect: () => editor.value!.chain().focus().setHardBreak().run() }
    ]
  }
])

const listsItems = ref<NavigationMenuItem[]>([
  {
    label: 'Lists',
    icon: 'i-lucide-list',
    children: [
      { label: 'Bullet list', icon: 'i-lucide-list', description: 'Toggle bullet list', onSelect: () => editor.value!.chain().focus().toggleBulletList().run() },
      { label: 'Ordered list', icon: 'i-lucide-list-number', description: 'Toggle ordered list', onSelect: () => editor.value!.chain().focus().toggleOrderedList().run() }
    ]
  }
])

const insertItems = ref<NavigationMenuItem[]>([
  {
    label: 'Insert',
    icon: 'i-lucide-plus-square',
    children: [
      { label: 'Add image from URL', icon: 'i-lucide-image', description: 'Insert an image by URL', onSelect: () => addImage() }
    ]
  }
])

const colorsItems = ref<NavigationMenuItem[]>([
  {
    label: 'Colors',
    icon: 'i-lucide-palette',
    children: [
      { label: 'Primary', icon: 'i-lucide-circle', description: 'Primary color', onSelect: () => editor.value!.chain().focus().setColor('#2563EB').run() },
      { label: 'Secondary', icon: 'i-lucide-circle', description: 'Secondary color', onSelect: () => editor.value!.chain().focus().setColor('#6B7280').run() },
      { label: 'Neutral', icon: 'i-lucide-circle', description: 'Neutral / dark', onSelect: () => editor.value!.chain().focus().setColor('#111827').run() },
      { label: 'Red', icon: 'i-lucide-circle', description: 'Red', onSelect: () => editor.value!.chain().focus().setColor('#EF4444').run() },
      { label: 'Green', icon: 'i-lucide-circle', description: 'Green', onSelect: () => editor.value!.chain().focus().setColor('#10B981').run() },
      { label: 'Blue', icon: 'i-lucide-circle', description: 'Blue', onSelect: () => editor.value!.chain().focus().setColor('#3B82F6').run() },
      { label: 'Purple', icon: 'i-lucide-circle', description: 'Purple', onSelect: () => editor.value!.chain().focus().setColor('#8B5CF6').run() },
      { label: 'Yellow', icon: 'i-lucide-circle', description: 'Yellow', onSelect: () => editor.value!.chain().focus().setColor('#F59E0B').run() }
    ]
  }
])

// ---------- lifecycle cleanup ----------
onBeforeUnmount(async () => {
  if (collaborationHandle.value?.cleanup) {
    try { await collaborationHandle.value.cleanup() } catch (e) { /* ignore */ }
    collaborationHandle.value = null
  }
  if (editor.value) {
    try { editor.value.destroy() } catch (e) { /* ignore */ }
    editor.value = null
  }
})

// ---------- mount and initialization ----------
onMounted(async () => {
  // create editor instance
  editor.value = new Editor({
    extensions: [
      // disable StarterKit document to avoid duplicate 'doc' name
      StarterKit.configure({ document: false }),
      CustomDocument,
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      TextStyle.configure({ types: [ListItem.name] }),
      Image,
      // dropcursor intentionally omitted
      TaskList,
      CustomTaskItem,
    ],
    content: props.modelValue || "",

  })
  // Emit updates for v-model
  editor.value.on("update", () => {
    const html = editor.value?.getHTML();
    emit("update:modelValue", html || "");
  });

  // dev transaction logger (safe)
  try {
    editor.value.on('transaction', ({ transaction }) => {
      try {
        // console.group('TipTap transaction',transaction)
        // console.log(transaction.steps.map(s => s.constructor.name))
        // console.log(transaction.steps.map(s => s.toJSON()))
        // console.groupEnd()
      } catch (e) { /* ignore */ }
    })
  } catch (e) { /* ignore registration errors */ }

  // ensure view is mounted
  await nextTick()

  // attach bookmark tracker so savedBookmark maps forward with transactions
  attachBookmarkTracker()

  // init collaboration defensively (disabled for now)
  // try {
  //   const result = await initCollaboration(editor.value!, { roomName: 'my-doc' })
  //   if (result.ok) {
  //     collaborationHandle.value = result as CollaborationHandle
  //   } else {
  //     console.warn('Collab init skipped', result)
  //   }
  // } catch (err) {
  //   console.warn('Collab init error', err)
  // }
})

// ---------- selection helpers ----------
function getSelectedText(): string | null {
  if (!editor.value) return null
  const state = editor.value.state
  const { from, to } = state.selection
  // textBetween will extract text across nodes; pass null to not include leaf node chars
  try {
    return state.doc.textBetween(from, to, '\n')
  } catch (e) {
    console.warn('getSelectedText failed', e)
    return null
  }
}

function saveSelectionBookmarkAndText(): { text: string | null, ok: boolean } {
  if (!editor.value) return { text: null, ok: false }
  const state = editor.value.state
  const sel = state.selection
  if (!sel) return { text: null, ok: false }
  // store text for quick use
  savedSelectionText.value = state.doc.textBetween(sel.from, sel.to, '\n')
  // store bookmark to be resilient to local edits
  savedBookmark = sel.getBookmark()
  return { text: savedSelectionText.value, ok: true }
}

function restoreSelectionFromSavedBookmark(): boolean {
  if (!editor.value || !savedBookmark) return false
  try {
    const sel = (savedBookmark as SelectionBookmark).resolve(editor.value.state.doc) as PMSelection
    const tr = editor.value.state.tr.setSelection(sel).scrollIntoView()
    editor.value.view.dispatch(tr)
    return true
  } catch (e) {
    console.warn('restoreSelectionFromSavedBookmark failed', e)
    return false
  }
}

// ----------------- Marker demo (persist across reloads) -----------------
function generateId() {
  // simple id; replace with a UUID generator if you prefer
  return Math.random().toString(36).slice(2, 10)
}

function insertSelectionMarker() {
  if (!editor.value) return
  const id = generateId()
  const token = `[[MARKER:${id}]]`
  // insert the token at current selection (as plain text)
  editor.value.chain().focus().insertContent(token).run()
  // persist id so we can attempt cross-reload restore
  try {
    localStorage.setItem('tiptap-marker-id', id)
    console.log('Inserted marker', id)
  } catch (e) {
    console.warn('Could not persist marker id', e)
  }
}

function restoreMarkerFromLocalStorage() {
  if (!editor.value) return false
  try {
    const id = localStorage.getItem('tiptap-marker-id')
    if (!id) {
      console.warn('no marker id in localStorage')
      return false
    }

    const token = `[[MARKER:${id}]]`
    // find token in document text
    const docText = editor.value.state.doc.textContent || ''
    const idx = docText.indexOf(token)
    if (idx === -1) {
      console.warn('marker token not found in document')
      return false
    }

    // compute from/to positions by scanning document for positions — use a walking approach
    let pos = 0
    let foundFrom = -1
    let foundTo = -1
    // walk through top-level nodes to compute absolute positions
    editor.value.state.doc.descendants((node, posSoFar) => {
      if (foundFrom !== -1) return false // stop walking
      const text = node.isText ? node.text || '' : ''
      if (text) {
        const localIdx = text.indexOf(token)
        if (localIdx !== -1) {
          // absolute position = posSoFar + localIdx
          foundFrom = posSoFar + localIdx
          foundTo = foundFrom + token.length
          return false
        }
      }
      return true
    })

    if (foundFrom === -1) {
      console.warn('marker token not located by node traversal')
      return false
    }

    // set selection at token start and remove the token
    const tr = editor.value.state.tr
    const sel = editor.value.state.selection
    // Some bundlers expose Selection differently; use the running editor's selection constructor at runtime
    const SelCtor: any = (editor.value.state.selection as any).constructor
    tr.setSelection(SelCtor.create(editor.value.state.doc, foundFrom, foundTo))
    tr.delete(foundFrom, foundTo)
    editor.value.view.dispatch(tr.scrollIntoView())

    // clean up persisted id
    localStorage.removeItem('tiptap-marker-id')
    console.log('Restored and removed marker', id)
    return true
  } catch (e) {
    console.warn('restoreMarkerFromLocalStorage failed', e)
    return false
  }
}

// try auto-restore on mount (if a marker id exists)
onMounted(() => {
  try {
    const stored = localStorage.getItem('tiptap-marker-id')
    if (stored) {
      // schedule a tick so editor view is ready
      setTimeout(() => {
        restoreMarkerFromLocalStorage()
      }, 200)
    }
  } catch (e) { /* ignore */ }
})

// UI handlers for the test buttons
function handleGetSelection() {
  const text = getSelectedText()
  console.log('CURRENT SELECTION TEXT:', text)
  // optionally you can emit or process the selected text here
}

function handleSaveSelection() {
  const res = saveSelectionBookmarkAndText()
  if (res.ok) {
    console.log('SAVED SELECTION TEXT:', res.text)
  } else {
    console.warn('No selection to save')
  }
}

// ---------- methods used by template (other utilities) ----------
function addImage(): void {
  if (!editor.value) return
  const url = window.prompt('URL')
  if (url) {
    editor.value.chain().focus().setImage({ src: url }).run()
  }
}

function addTaskItem(): void {
  if (!editor.value) return
  editor.value
    .chain()
    .focus()
    .insertContent('<li data-type="taskItem" data-checked="false"><p></p></li>')
    .run()
}

function toggleTaskItem(): void {
  if (!editor.value) return
  const state = editor.value.state
  const pos = state.selection.$from
  const node = pos.node(pos.depth)

  if (node.type.name !== 'taskItem') return

  const isChecked = node.attrs.checked

  editor.value
    .chain()
    .focus()
    .updateAttributes('taskItem', { checked: !isChecked })
    .run()
}
</script>

<style>
/* container class used in your template */
.tiptap {
  color: inherit;
  font-family: 'Inter', sans-serif;
}

.tiptap:focus-visible {
  outline: none;
}

/* Basic list spacing */
.tiptap ul,
.tiptap ol {
  padding: 0 1rem;
  margin: 1.25rem 1rem 1.25rem 0.4rem;
  list-style: none;
  /* taskList is custom, remove bullets */
}

.tiptap p {
  font-size: .8rem;
}

/* paragraphs inside list items — less spacing */
.tiptap ul li p,
.tiptap ol li p {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

/* headings */
.tiptap h1 {
  font-size: 1.4rem;
}

.tiptap h2 {
  font-size: 1.2rem;
}

.tiptap h3 {
  font-size: 1.1rem;
}

.tiptap h4,
.tiptap h5,
.tiptap h6 {
  font-size: 1rem;
}

/* code blocks */
.tiptap code {
  background-color: var(--purple-light);
  border-radius: 0.4rem;
  color: var(--color-dark);
  font-size: 0.85rem;
  padding: 0.25em 0.3em;
}

.tiptap pre {
  background: var(--color-dark);
  border-radius: 0.5rem;
  color: var(--color-light);
  font-family: 'JetBrainsMono', monospace;
  margin: 1.5rem 0;
  padding: 0.75rem 1rem;
}

/* blockquote & hr */
.tiptap blockquote {
  border-left: 3px solid var(--gray-3);
  margin: 1.5rem 0;
  padding-left: 1rem;
}

.tiptap hr {
  border: none;
  border-top: 1px solid var(--color-neutral);
  margin: .5rem 0;
}

/* Task list styles */
ul[data-type='taskList'] {
  list-style: none;
  margin-left: 0;
  padding: 0;
}

ul[data-type='taskList'] li {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .25rem 0;
}

/* label/checkbox layout inside task item */
ul[data-type='taskList'] li>label {
  flex: 0 0 auto;
  margin-right: 0.5rem;
  user-select: none;
  display: inline-flex;
  align-items: center;
}

ul[data-type='taskList'] li[data-checked="true"]>div p {
  text-decoration: line-through;
  opacity: 0.7;
}

/* content wrapper (the editable text) */
ul[data-type='taskList'] li>div {
  flex: 1 1 auto;
}

/* checkbox style */
ul[data-type='taskList'] input[type='checkbox'] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

/* images */
.tiptap img {
  display: block;
  height: auto;
  margin: 1.5rem 0;
  max-width: 100%;
}
</style>