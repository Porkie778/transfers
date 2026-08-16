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
// This is a simple screen to keep casual visitors out — it is NOT real
// security (anyone who views the page source can read this value, and
// the underlying data is only as protected as your Firestore rules).
// See README.md for how to actually lock down the data with Firestore
// security rules if that matters for your use case.
export const STORE_PASSWORD = "oandcc";
