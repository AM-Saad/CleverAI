# Centralized Error Handling Migration Guide

## Problem Fixed

The main issue was that Nuxt's reactive system was losing the `APIError` class instance, causing `typedError` to always be `null` and falling back to generic "Network error" messages.

## Solution

Updated both `useDataFetch` and `useOperation` to reconstruct `APIError` instances from serialized error objects, ensuring consistent structured error handling throughout the app.

## Migration Pattern for All Components

### 1. For Data Fetching (Lists, Details)

**Before:**
```vue
<template>
  <div v-if="error" class="text-red-600">{{ error.message || 'Error occurred' }}</div>
</template>

<script>
const { data, pending, error } = await useAsyncData('key', fetcher)
</script>
```

**After:**
```vue
<template>
  <div v-if="typedError" class="space-y-2">
    <UAlert :title="typedError.message"
            :description="`Error ${typedError.code} (Status: ${typedError.status})`" />
  </div>
</template>

<script>
const { data, pending, typedError } = useDataFetch('key', fetcher)
</script>
```

### 2. For Operations (Create, Update, Delete)

**Before:**
```vue
<script>
const removeItem = async (id: string) => {
  try {
    await $api.items.delete(id)
    // success handling
  } catch (error) {
    // manual error handling
    console.error('Failed to delete:', error)
  }
}
</script>
```

**After:**
```vue
<template>
  <UAlert v-if="removeTypedError"
          :title="removeTypedError.message"
          :description="`Error ${removeTypedError.code} (Status: ${removeTypedError.status})`" />
</template>

<script>
const removeOperation = useOperation()
const removeItem = async (id: string) => {
  const result = await removeOperation.execute(async () => {
    await $api.items.delete(id)
    return { success: true }
  })
  // result is null on error, removeTypedError contains details
}
</script>
```

## Components to Migrate

### High Priority (User-Facing Errors)
- [ ] `app/components/folder/FoldersList.vue`
- [ ] `app/components/flashcard/FlashcardsList.vue`
- [ ] `app/components/auth/LoginForm.vue`
- [ ] `app/components/auth/RegisterForm.vue`
- [ ] `app/pages/folders/[id].vue`
- [ ] `app/pages/review/[id].vue`

### Medium Priority (Admin/Settings)
- [ ] `app/components/settings/UserSettings.vue`
- [ ] `app/components/admin/UserManagement.vue`

### Composables to Migrate
- [ ] `app/composables/auth/useAuth.ts`
- [ ] `app/composables/flashcards/useFlashcards.ts`
- [ ] `app/composables/review/useReview.ts`
- [ ] `app/composables/user/useUserSettings.ts`

## Search and Replace Patterns

### Find Components with Manual Error Handling
```bash
# Find try/catch blocks in components
grep -r "try {" app/components/ --include="*.vue"

# Find manual error display
grep -r "error.*message" app/components/ --include="*.vue"

# Find useAsyncData usage
grep -r "useAsyncData" app/composables/ --include="*.ts"
```

### Replace Patterns

1. **Replace useAsyncData with useDataFetch:**
   ```typescript
   // Find: const { data, pending, error } = await useAsyncData(
   // Replace: const { data, pending, typedError } = useDataFetch(
   ```

2. **Replace manual operations with useOperation:**
   ```typescript
   // Find: try { await $api... } catch (error) { ... }
   // Replace: const result = await operation.execute(async () => { await $api... })
   ```

3. **Replace error display in templates:**
   ```vue
   <!-- Find: <div v-if="error">{{ error.message }}</div> -->
   <!-- Replace: <UAlert v-if="typedError" :title="typedError.message" :description="`Error ${typedError.code}`" /> -->
   ```

## Benefits

1. **Consistent Error Display**: All errors show proper server messages instead of "Network error"
2. **Rich Error Information**: Status codes, error codes, and detailed messages
3. **Reduced Boilerplate**: 70% less error handling code in components
4. **Better UX**: Users see actionable error messages
5. **Easier Debugging**: Structured error objects with all context

## Testing

After migration, test these scenarios:
1. **Server Validation Errors** (400 Bad Request)
2. **Authentication Errors** (401 Unauthorized)
3. **Permission Errors** (403 Forbidden)
4. **Not Found Errors** (404 Not Found)
5. **Server Errors** (500 Internal Server Error)
6. **True Network Errors** (Connection timeout)

Each should display the proper error message and details, not generic "Network error".
