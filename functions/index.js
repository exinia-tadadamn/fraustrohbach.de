/**
 * Firebase Cloud Functions
 *
 * The Instagram scraper was removed to comply with platform Terms of Service
 * and eliminate legal/account-ban risks. If you need Instagram content in blog
 * posts, copy the image URL and caption manually into the compose form.
 */

const functions = require('firebase-functions');

// Placeholder: returns a graceful error if anything still calls the old endpoint.
exports.scrapeInstagram = functions.https.onCall((data, context) => {
  throw new functions.https.HttpsError(
    'unimplemented',
    'Instagram auto-import has been disabled. Please paste image URLs and captions manually.'
  );
});
