/**
 * backup-firestore.js
 *
 * Exports Firestore collections to local JSON files for backup.
 * Requires Firebase Admin SDK credentials.
 *
 * Prerequisites:
 *   1. Download your service account key from Firebase Console
 *      → Project Settings → Service Accounts → Generate new private key
 *   2. Save it as `serviceAccountKey.json` in the project root (or set GOOGLE_APPLICATION_CREDENTIALS)
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   node scripts/backup-firestore.js
 */
const fs = require('fs');
const path = require('path');

// Only require firebase-admin when the script is actually run
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('firebase-admin is not installed.');
  console.error('Install it with: npm install firebase-admin');
  process.exit(1);
}

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const COLLECTIONS = ['blogPosts', 'galleryAlbums', 'comments', 'userProfiles', 'nicknames'];

async function backup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(BACKUP_DIR, timestamp);
  fs.mkdirSync(backupFolder, { recursive: true });

  // Initialize if not already initialized
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const db = admin.firestore();

  for (const collectionName of COLLECTIONS) {
    const snapshot = await db.collection(collectionName).get();
    const docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const filePath = path.join(backupFolder, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
    console.log(`Backed up ${docs.length} docs from "${collectionName}" → ${filePath}`);
  }

  console.log(`\nBackup complete: ${backupFolder}`);
}

backup().catch(err => {
  console.error('Backup failed:', err.message);
  console.error('\nMake sure you have set GOOGLE_APPLICATION_CREDENTIALS to your service account key.');
  process.exit(1);
});
