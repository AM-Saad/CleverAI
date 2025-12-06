#!/usr/bin/env tsx
/**
 * Cleanup script to remove orphaned UserNotificationPreferences records
 * where the referenced user no longer exists.
 * 
 * Run with: yarn tsx scripts/cleanup-orphaned-preferences.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupOrphanedPreferences() {
  console.log('🧹 Starting cleanup of orphaned notification preferences...');
  
  try {
    // Find all preferences
    const allPreferences = await prisma.userNotificationPreferences.findMany({
      select: {
        id: true,
        userId: true,
      },
    });
    
    console.log(`📊 Found ${allPreferences.length} total preference records`);
    
    // Find all user IDs
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
      },
    });
    
    const userIds = new Set(allUsers.map(u => u.id));
    console.log(`👥 Found ${userIds.size} total users`);
    
    // Find orphaned preferences
    const orphanedPreferences = allPreferences.filter(
      pref => !userIds.has(pref.userId)
    );
    
    if (orphanedPreferences.length === 0) {
      console.log('✅ No orphaned preferences found!');
      return;
    }
    
    console.log(`⚠️  Found ${orphanedPreferences.length} orphaned preference records`);
    console.log('🗑️  Deleting orphaned records...');
    
    // Delete orphaned preferences
    const result = await prisma.userNotificationPreferences.deleteMany({
      where: {
        id: {
          in: orphanedPreferences.map(p => p.id),
        },
      },
    });
    
    console.log(`✅ Deleted ${result.count} orphaned preference records`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupOrphanedPreferences()
  .then(() => {
    console.log('✨ Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
