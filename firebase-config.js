// ── Firebase configuration ───────────────────────────────────────────
// Replace the values below with your own Firebase project's config.
// Get these from: Firebase Console → Project settings → General →
// "Your apps" → SDK setup and configuration → Config.
//
// See README.md for full step-by-step setup instructions.

export const firebaseConfig = {
  apiKey: "AIzaSyBUKVYBHpnME6Xjwffa0yEgL9Ut1ccOrV4",
  authDomain: "stock-transfers-32836.firebaseapp.com",
  projectId: "stock-transfers-32836",
  storageBucket: "stock-transfers-32836.firebasestorage.app",
  messagingSenderId: "961960621593",
  appId: "1:961960621593:web:d8fc806e0112a108955c88"
};

// ── Shared store password ────────────────────────────────────────────
// The password is stored as a SHA-256 hash, not plaintext — so anyone
// viewing the page source sees only the hash, not the actual password.
//
// This is still a deterrent, not real authentication: the hash can in
// principle be brute-forced offline, and the underlying data is only
// as protected as your Firestore rules. For real access control, put
// the site behind Cloudflare Access or add Firebase Authentication.
//
// To generate a new hash for your own password, open this site in a
// browser, open the console (F12), and run:
//
//   await hashPassword("your-new-password")
//
// Copy the printed hash into STORE_PASSWORD_HASH below.
//
// Default below is the hash for "changeme" — change it before deploying.
export const STORE_PASSWORD_HASH =
  "057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86";
