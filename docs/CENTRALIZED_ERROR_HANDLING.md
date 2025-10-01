# Centralized Error Handling Pattern

## Overview

The app uses a centralized error handling approach where all errors are constructed by the `FetchFactory` and consumed through standardized composables. This eliminates manual error handling in individual composables and ensures consistent error structures throughout the application.

## Architecture

### 1. FetchFactory (Error Construction)
- **Location**: `app/services/FetchFactory.ts`
- **Responsibility**: Converts all errors into structured `APIError` instances
- **Features**:
  - Normalizes network, server, and application errors
  - Provides retry logic for 429/503 status codes
  - Supports envelope-based and legacy response formats
  - Includes error hooks for global error handling

### 2. useDataFetch (Data Operations)
- **Location**: `app/composables/shared/useDataFetch.ts`
- **Responsibility**: Wraps `useAsyncData` to provide centralized error handling for data fetching
- **Exports**: `{ data, pending, error, typedError, refresh, execute }`

### 3. useOperation (Single Operations)
- **Location**: `app/composables/shared/useOperation.ts`
- **Responsibility**: Handles one-off operations (create, update, delete) with centralized error handling
- **Exports**: `{ pending, error, typedError, data, execute, reset }`

## Implementation Pattern

### Before (Manual Error Handling)
```typescript
export function useMaterials(folderId: string) {
  const { $api } = useNuxtApp()

  // Manual state management
  const removing = ref(false)
  const removeError = ref<unknown>(null)
  const removeTypedError = ref<APIError | null>(null)

  async function removeMaterial(id: string) {
    removing.value = true
    removeError.value = null
    removeTypedError.value = null

    try {
      const res = await $api.materials.delete(id)
      await refresh()
      return res
    } catch (err: unknown) {
      // Manual error construction
      removeError.value = err
      removeTypedError.value = err instanceof Error && (err as Error).name === 'APIError'
        ? (err as APIError)
        : null
      throw err
    } finally {
      removing.value = false
    }
  }

  return { removing, removeError, removeTypedError, removeMaterial }
}
```

### After (Centralized Error Handling)
```typescript
import { useDataFetch } from '~/composables/shared/useDataFetch'
import { useOperation } from '~/composables/shared/useOperation'

export function useMaterials(folderId: string) {
  const { $api } = useNuxtApp()

  // Main materials data - FetchFactory handles all errors
  const { data, pending, error, typedError, refresh } = useDataFetch<Material[]>(
    \`materials-\${folderId}\`,
    () => $api.materials.getByFolder(folderId)
  )

  // Remove operation - FetchFactory handles all errors
  const removeOperation = useOperation<{ success: boolean; message: string }>()

  const removeMaterial = async (id: string) => {
    const result = await removeOperation.execute(async () => {
      const deleteResult = await $api.materials.delete(id)
      await refresh() // Refresh on success
      return deleteResult
    })
    return result
  }

  return {
    // Main materials state
    materials: data,
    loading: pending,
    error,
    typedError,
    refresh,

    // Remove operation state - all errors centralized
    removing: removeOperation.pending,
    removeError: removeOperation.error,
    removeTypedError: removeOperation.typedError,
    removeMaterial
  }
}
```

## Benefits

### 1. **Consistent Error Structure**
- All errors are `APIError` instances with `.status`, `.code`, and `.message`
- Standardized error format across the entire application
- Type-safe error handling with `typedError` computed property

### 2. **Reduced Boilerplate**
- No manual try/catch blocks in composables
- No manual loading state management for operations
- No manual error type checking or construction

### 3. **Centralized Error Logic**
- Network errors, timeouts, and server errors handled in one place
- Retry logic automatically applied where appropriate
- Error normalization ensures consistent developer experience

### 4. **Better Developer Experience**
- Components can focus on business logic instead of error handling
- Predictable error access patterns: `error` (raw) and `typedError` (structured)
- Automatic loading states for all operations

## Component Usage

### Accessing Errors in Components
```vue
<template>
  <div>
    <!-- Loading states -->
    <div v-if="loading">Loading materials...</div>
    <div v-if="removing">Removing material...</div>

    <!-- Error displays -->
    <UAlert
      v-if="typedError"
      color="red"
      :title="typedError.message"
      :description="\`Error \${typedError.code} (Status: \${typedError.status})\`"
    />

    <UAlert
      v-if="removeTypedError"
      color="red"
      :title="removeTypedError.message"
      :description="\`Failed to remove material: \${removeTypedError.code}\`"
    />

    <!-- Materials list -->
    <div v-for="material in materials" :key="material.id">
      {{ material.title }}
      <UButton @click="removeMaterial(material.id)">Remove</UButton>
    </div>
  </div>
</template>

<script setup>
const { materials, loading, typedError, removing, removeTypedError, removeMaterial } = useMaterials(folderId)
</script>
```

### Error Details Available
```typescript
// typedError provides structured access to:
typedError.value?.message    // Human-readable error message
typedError.value?.status     // HTTP status code (404, 500, etc.)
typedError.value?.code       // Application error code ('NETWORK_ERROR', 'VALIDATION_FAILED', etc.)
typedError.value?.cause      // Original error details
```

## Migration Guidelines

### 1. Replace Manual Error Handling
- Remove manual `try/catch` blocks in composables
- Remove manual `loading.value = true/false` state management
- Remove manual error type checking and construction

### 2. Use Centralized Composables
- Use `useDataFetch()` for data fetching operations
- Use `useOperation()` for single operations (create, update, delete)
- Let FetchFactory handle all error construction

### 3. Update Component Error Access
- Access errors via `error` (raw) and `typedError` (structured) from composables
- Use `typedError` for displaying user-friendly error messages
- Leverage automatic loading states from composables

### 4. Service Layer Unchanged
- Service classes (MaterialService, FolderService, etc.) remain unchanged
- They call `FetchFactory.call()` which handles all error construction
- No changes needed to API endpoint implementations

## Examples for Other Composables

### Folders
```typescript
// Before: Manual error handling in useCreateFolder
// After: Use useOperation
export function useCreateFolder() {
  const createOperation = useOperation<IFolder>()

  const createFolder = async (payload: CreateFolderDTO) => {
    return await createOperation.execute(async () => {
      return await $api.folders.postFolder(payload)
    })
  }

  return {
    createFolder,
    creating: createOperation.pending,
    error: createOperation.error,
    typedError: createOperation.typedError,
  }
}
```

### Flashcards
```typescript
// Similar pattern for flashcard operations
export function useFlashcards(folderId: string) {
  const { data, pending, error, typedError, refresh } = useDataFetch<Flashcard[]>(
    \`flashcards-\${folderId}\`,
    () => $api.flashcards.getByFolder(folderId)
  )

  const createOperation = useOperation<Flashcard>()
  const updateOperation = useOperation<Flashcard>()
  const deleteOperation = useOperation<{ success: boolean }>()

  // All operations delegate to FetchFactory for error handling
  const createFlashcard = async (payload: CreateFlashcardDTO) => {
    const result = await createOperation.execute(async () => {
      const created = await $api.flashcards.create(payload)
      await refresh()
      return created
    })
    return result
  }

  return {
    flashcards: data,
    loading: pending,
    error,
    typedError,
    refresh,
    createFlashcard,
    creating: createOperation.pending,
    createError: createOperation.typedError,
    // ... other operations
  }
}
```

## Key Principles

1. **FetchFactory is the source of truth** for all error construction
2. **Composables delegate** error handling to FetchFactory via useDataFetch/useOperation
3. **Components consume** errors through standardized `error`/`typedError` properties
4. **No manual error handling** in business logic - focus on functionality
5. **Consistent patterns** across all data operations throughout the app

This centralized approach ensures maintainable, consistent error handling while reducing boilerplate and improving developer experience.
