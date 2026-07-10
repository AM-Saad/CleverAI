<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { openUnifiedDB, countRecords, getAllRecords } from '~/utils/idb'
import { DB_CONFIG } from '~/utils/constants/pwa'

interface MutationRecordPreview {
  id: string
  type: string
  ageMs: number
}

const mutationsCount = ref<number>(0)
const notesCount = ref<number>(0)
const loading = ref(true)
const error = ref<string | null>(null)
const mutationsPreview = ref<MutationRecordPreview[]>([])

async function load() {
  loading.value = true
  error.value = null
  try {
    const db = await openUnifiedDB()
    mutationsCount.value = await countRecords(db, DB_CONFIG.STORES.OFFLINE_MUTATIONS as any)
    notesCount.value = await countRecords(db, DB_CONFIG.STORES.NOTES as any)
    // Preview the durable v2 outbox, never the retired form queue.
    try {
      // Reuse generic getAllRecords; cast store name type
      const all = await getAllRecords<any>(db, DB_CONFIG.STORES.OFFLINE_MUTATIONS as any)
      mutationsPreview.value = all.slice(0, 10).map(r => ({
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
        <li><strong>Mutations queued:</strong> {{ mutationsCount }}</li>
        <li><strong>Notes stored:</strong> {{ notesCount }}</li>
      </ul>
      <div class="preview" v-if="mutationsPreview.length">
        <h4>Outbox (first 10)</h4>
        <table>
          <thead><tr><th>ID</th><th>Type</th><th>Age (s)</th></tr></thead>
          <tbody>
            <tr v-for="f in mutationsPreview" :key="f.id">
              <td>{{ f.id }}</td>
              <td>{{ f.type }}</td>
              <td>{{ Math.round(f.ageMs/1000) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else>
        <em>No mutations queued.</em>
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
