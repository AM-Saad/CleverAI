<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { openUnifiedDB, countRecords, getAllRecords } from '~/utils/idb'
import { DB_CONFIG } from '~/utils/constants/pwa'

interface FormRecordPreview {
  id: string
  type: string
  ageMs: number
}

const formsCount = ref<number>(0)
const notesCount = ref<number>(0)
const loading = ref(true)
const error = ref<string | null>(null)
const formsPreview = ref<FormRecordPreview[]>([])

async function load() {
  loading.value = true
  error.value = null
  try {
    const db = await openUnifiedDB()
    formsCount.value = await countRecords(db, DB_CONFIG.STORES.FORMS as any)
    notesCount.value = await countRecords(db, DB_CONFIG.STORES.NOTES as any)
    // Preview first 10 form entries
    try {
      // Reuse generic getAllRecords; cast store name type
      const all = await getAllRecords<any>(db, DB_CONFIG.STORES.FORMS as any)
      formsPreview.value = all.slice(0, 10).map(r => ({
        id: r.id,
        type: r.type,
        ageMs: Date.now() - r.createdAt
      }))
    } catch {}
  } catch (e:any) {
    error.value = e?.message || 'Failed to open IndexedDB'
  } finally {
    loading.value = false
  }
}

onMounted(() => { load() })
</script>

<template>
  <div class="offline-debug-panel">
    <h3>Offline / IndexedDB Debug</h3>
    <button @click="load" :disabled="loading">Refresh</button>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <div v-if="error" class="error">{{ error }}</div>
      <ul class="stats">
        <li><strong>Forms queued:</strong> {{ formsCount }}</li>
        <li><strong>Notes stored:</strong> {{ notesCount }}</li>
      </ul>
      <div class="preview" v-if="formsPreview.length">
        <h4>Forms Queue (first 10)</h4>
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Age (s)</th></tr></thead>
          <tbody>
            <tr v-for="f in formsPreview" :key="f.id">
              <td>{{ f.id }}</td>
              <td>{{ f.type }}</td>
              <td>{{ Math.round(f.ageMs/1000) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else>
        <em>No forms queued.</em>
      </div>
    </div>
  </div>
</template>

<style scoped>
.offline-debug-panel { border: 1px solid var(--border-color, #ddd); padding: 1rem; border-radius: 6px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
button { margin-bottom: .5rem; }
.error { color: #b00020; margin:.5rem 0; }
.stats { list-style: none; padding:0; margin:.5rem 0 1rem; }
.stats li { margin: .25rem 0; }
.preview table { width:100%; border-collapse: collapse; }
.preview th, .preview td { padding:.25rem .5rem; border:1px solid #eee; font-size:.75rem; }
.preview th { background:#f9f9f9; text-align:left; }
</style>
