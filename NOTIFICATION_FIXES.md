# Critical Notification System Fixes

## 1. Generate New VAPID Keys (URGENT)
```bash
npx web-push generate-vapid-keys
```

## 2. Update Prisma Schema
```prisma
model NotificationSubscription {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  endpoint  String
  keys      SubscriptionKeys
  userId    String?  @db.ObjectId
  user      User?    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
  expiresAt DateTime?
  isActive  Boolean  @default(true)

  @@unique([endpoint])
  @@index([userId])
  @@index([expiresAt])
}
```

## 3. Fix Service Worker Push Handler
```typescript
self.addEventListener("push", async (event: PushEvent) => {
  try {
    if (!event.data) {
      console.warn('Push event has no data');
      return;
    }

    const data = event.data.json();

    // Validate required fields
    if (!data.title && !data.message) {
      console.error('Invalid push notification data');
      return;
    }

    const options = {
      body: data.message || '',
      icon: '/icons/192x192.png', // Use local icon
      badge: '/icons/96x96.png',
      tag: data.tag || 'default',
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      data: data.data || {},
    };

    await self.registration.showNotification(
      data.title || 'Notification',
      options
    );
  } catch (error) {
    console.error('Error in push event handler:', error);
  }
});
```

## 4. Add Request Validation
```typescript
// server/api/notifications/send.post.ts
import { z } from 'zod';

const NotificationSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  icon: z.string().url().optional(),
  tag: z.string().optional(),
  requireInteraction: z.boolean().optional(),
  targetUsers: z.array(z.string()).optional(),
});

export default defineEventHandler(async (event) => {
  try {
    // Validate request body
    const body = await readBody(event);
    const message = NotificationSchema.parse(body);

    // Add authentication check
    const session = await getServerSession(event);
    if (!session?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Rest of your code...
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request data',
        data: error.errors
      });
    }
    throw error;
  }
});
```

## 5. Improve Client Error Handling
```typescript
// composables/shared/useNotifications.ts
export function useNotifications() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isSubscribed = ref(false);

  const checkPermission = async () => {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }
    return Notification.permission;
  };

  const checkServiceWorkerSupport = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    if (!('PushManager' in window)) {
      throw new Error('Push notifications not supported');
    }
  };

  const registerNotification = async (): Promise<void> => {
    try {
      await checkServiceWorkerSupport();

      let permission = await checkPermission();

      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        throw new Error(`Notification permission ${permission}`);
      }

      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        isSubscribed.value = true;
        return;
      }

      isLoading.value = true;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          config.public.VAPID_PUBLIC_KEY as string,
        ),
      });

      const response = await $fetch("/api/notifications/subscribe", {
        method: "POST",
        body: subscription,
      });

      if (response.success) {
        isSubscribed.value = true;
        console.log("Subscription successful");
      }

    } catch (err: any) {
      error.value = err.message || 'Failed to register notifications';
      console.error("Notification registration error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    isLoading,
    error,
    isSubscribed,
    registerNotification,
    checkPermission,
  };
}
```
