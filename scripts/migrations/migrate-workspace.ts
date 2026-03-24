import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      const envPath = path.resolve('.env.development');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const dbUrlLine = envContent.split('\n').find(line => line.startsWith('DATABASE_URL='));
        if (dbUrlLine) {
          process.env.DATABASE_URL = dbUrlLine.substring(dbUrlLine.indexOf('=') + 1).replace(/^"|"$/g, '').trim();
        }
      }
    } catch (e) {
      console.warn('Could not read .env.development');
    }
  }

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Use the standard MongoDB driver to connect directly
  const client = new MongoClient(uri);

  try {
    console.log('Connecting to database...');
    await client.connect();
    const db = client.db();
    
    // 1. Rename the Folder collection to Workspace
    const collections = await db.listCollections().toArray();
    const hasFolder = collections.some(c => c.name === 'Folder');
    const hasWorkspace = collections.some(c => c.name === 'Workspace');

    if (hasFolder && !hasWorkspace) {
      console.log('Renaming "Folder" collection to "Workspace"...');
      // This is the native MongoDB command to rename a collection
      await db.collection('Folder').rename('Workspace');
      console.log('✅ Collection renamed.');
    } else if (hasWorkspace) {
      console.log('ℹ️ "Workspace" collection already exists. Skipping collection rename.');
    } else {
      console.log('ℹ️ "Folder" collection does not exist. Skipping collection rename.');
    }

    // 2. Rename folderId to workspaceId in related collections
    const collectionsToUpdate = [
      'Material',
      'Note',
      'Question',
      'Flashcard',
      'CardReview',
      'llm_gateway_logs'
    ];

    for (const collName of collectionsToUpdate) {
      const exists = collections.some(c => c.name === collName);
      if (!exists) {
        console.log(`ℹ️ Collection "${collName}" does not exist, skipping field update.`);
        continue;
      }

      const coll = db.collection(collName);
      console.log(`Updating foreign keys in "${collName}"...`);
      
      // $rename safely renames the field if it exists, otherwise does nothing
      const result = await coll.updateMany(
        { folderId: { $exists: true } },
        { $rename: { 'folderId': 'workspaceId' } }
      );
      
      console.log(`✅ Updated ${result.modifiedCount} documents in "${collName}".`);
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    console.log('Closing database connection...');
    await client.close();
  }
}

main().catch(console.error);
