# Endpoint Migration Guide: Standardized Error Handling

This guide shows how to migrate existing API endpoints to use the new standardized error handling system.

## Overview of Changes

The new standardized error handling system provides:
- Consistent error response formats
- Correlation IDs for request tracking
- User-friendly error messages
- Enhanced validation with detailed field errors
- Automatic error monitoring and logging
- Structured API responses

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { ErrorFactory, ErrorType } from '~/services/ErrorFactory'
```

**After:**
```typescript
import { ResponseBuilder } from '../../utils/standardAPIResponse'
import { ErrorFactory, getErrorContextFromEvent } from '../../utils/standardErrorHandler'
import { validateBody, validateQuery } from '../../utils/validationHandler'
```

### 2. Add Error Context

**Before:**
```typescript
export default defineEventHandler(async (event) => {
  // endpoint logic
})
```

**After:**
```typescript
export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)
  // endpoint logic
})
```

### 3. Replace Manual Validation

**Before:**
```typescript
const body = await readBody(event)
const parsed = CreateMaterialDTO.safeParse(body)
if (!parsed.success) {
  throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
}
const data = parsed.data
```

**After:**
```typescript
const body = await readBody(event)
const data = await validateBody({ body }, CreateMaterialDTO)
```

### 4. Replace Manual Error Creation

**Before:**
```typescript
if (!folder) {
  throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
}
```

**After:**
```typescript
if (!folder) {
  throw ErrorFactory.notFound('folder', {
    ...context,
    resource: `folder:${folderId}`,
    metadata: { folderId, userId: user.id }
  })
}
```

### 5. Use Standardized Responses

**Before:**
```typescript
return materials
```

**After:**
```typescript
return new ResponseBuilder()
  .data(materials)
  .context({
    message: `Found ${materials.length} materials`,
    count: materials.length
  })
  .success()
```

### 6. Remove Try-Catch Wrappers

**Before:**
```typescript
try {
  // endpoint logic
  return data
} catch (error) {
  console.error('Error:', error)
  throw ErrorFactory.create(ErrorType.Validation, 'Resource', 'Failed')
}
```

**After:**
```typescript
// endpoint logic - errors are automatically handled
return new ResponseBuilder().data(data).success()
```

## Complete Example: GET Endpoint

**Before:**
```typescript
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ['USER'])

  try {
    const query = getQuery(event)
    const folderId = query.folderId as string

    if (!folderId) {
      throw createError({ statusCode: 400, statusMessage: 'folderId required' })
    }

    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: user.id }
    })
    if (!folder) {
      throw createError({ statusCode: 404, statusMessage: 'Folder not found' })
    }

    const materials = await prisma.material.findMany({
      where: { folderId }
    })

    return materials
  } catch (error) {
    throw ErrorFactory.create(ErrorType.Validation, 'Materials', 'Failed to fetch')
  }
})
```

**After:**
```typescript
import { z } from 'zod'
import { ResponseBuilder } from '../../utils/standardAPIResponse'
import { ErrorFactory, getErrorContextFromEvent } from '../../utils/standardErrorHandler'
import { validateQuery } from '../../utils/validationHandler'

const QuerySchema = z.object({
  folderId: z.string().uuid('Folder ID must be a valid UUID')
})

export default defineEventHandler(async (event) => {
  const context = getErrorContextFromEvent(event as unknown as Record<string, unknown>)
  const user = await requireRole(event, ['USER'])
  const prisma = event.context.prisma

  // Validate query parameters
  const query = await validateQuery({ query: getQuery(event) }, QuerySchema)

  // Verify folder ownership
  const folder = await prisma.folder.findFirst({
    where: { id: query.folderId, userId: user.id }
  })

  if (!folder) {
    throw ErrorFactory.notFound('folder', {
      ...context,
      resource: `folder:${query.folderId}`,
      metadata: { folderId: query.folderId, userId: user.id }
    })
  }

  // Get materials
  const materials = await prisma.material.findMany({
    where: { folderId: query.folderId },
    orderBy: { createdAt: 'desc' }
  })

  return new ResponseBuilder()
    .data(materials)
    .context({
      message: `Found ${materials.length} materials in folder`,
      folderId: query.folderId,
      count: materials.length
    })
    .success()
})
```

## Error Factory Methods

The `ErrorFactory` provides common error types:

```typescript
// Resource not found
ErrorFactory.notFound('user', context)

// Validation errors (automatically handled by validateBody/validateQuery)
ErrorFactory.validation('Invalid data', details, context)

// Authentication errors
ErrorFactory.unauthorized('Invalid token', context)

// Authorization errors
ErrorFactory.forbidden('Insufficient permissions', context)

// Rate limiting
ErrorFactory.rateLimit(context)

// External service errors
ErrorFactory.externalService('OpenAI', originalError, context)
```

## Response Builder API

The `ResponseBuilder` provides fluent response creation:

```typescript
// Simple success
new ResponseBuilder().data(result).success()

// With context
new ResponseBuilder()
  .data(result)
  .context({ message: 'Success', count: items.length })
  .success()

// Paginated response
new ResponseBuilder()
  .data(items)
  .paginated(page, limit, total)

// With performance tracking
new ResponseBuilder()
  .data(result)
  .cached(true)
  .queryCount(3)
  .success()
```

## Benefits

After migration, endpoints will have:

- ✅ Consistent error response format
- ✅ Automatic error correlation and tracking
- ✅ Enhanced validation with field-specific errors
- ✅ User-friendly error messages
- ✅ Automatic error monitoring and alerting
- ✅ Better debugging with structured logging
- ✅ Improved API documentation through standardized responses

## Testing

After migration, test endpoints to ensure:

1. **Validation errors** return detailed field information
2. **Not found errors** include resource context
3. **Success responses** follow consistent format
4. **Error monitoring** captures and logs errors appropriately

## Migration Checklist

For each endpoint:

- [ ] Update imports to use new error handling utilities
- [ ] Add error context extraction
- [ ] Replace manual validation with `validateBody`/`validateQuery`
- [ ] Replace `createError()` calls with `ErrorFactory` methods
- [ ] Use `ResponseBuilder` for consistent responses
- [ ] Remove unnecessary try-catch wrappers
- [ ] Test error scenarios and success responses
- [ ] Verify error monitoring integration works

## Support

For questions about the standardized error handling system:

1. Check the source code in `server/utils/`
2. Review existing migrated endpoints as examples
3. Run endpoints in development to see error responses
4. Monitor error dashboard at `/api/monitoring/dashboard`
