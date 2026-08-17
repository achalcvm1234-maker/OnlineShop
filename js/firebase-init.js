// ==================== FIREBASE CONFIGURATION ====================
// Loaded with `defer` after the Firebase compat SDKs, before every
// other app script. Every page uses the exact same SDK version and
// the exact same config, so there is a single source of truth.
const firebaseConfig = {
    apiKey: "AIzaSyAVvPXFzwbprJFHGk3iYOrUuWLdKZkI0VU",
    authDomain: "catlery-a4306.firebaseapp.com",
    projectId: "catlery-a4306",
    storageBucket: "catlery-a4306.firebasestorage.app",
    messagingSenderId: "931850924132",
    appId: "1:931850924132:web:be2ab4be301a803f832f71"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Local cache is what keeps repeat visits fast — Firestore serves
// reads from disk instead of round-tripping the network every time.
db.enablePersistence({ synchronizeTabs: true }).catch(() => {
    /* Persistence unavailable (private browsing / unsupported) — fine, just slower. */
});
