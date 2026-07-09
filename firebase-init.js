import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: 'AIzaSyDHzblZuhac_ui920koRywonV7KOuOS9P4',
  authDomain: 'croomx-34cb0.firebaseapp.com',
  databaseURL: 'https://croomx-34cb0-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'croomx-34cb0',
  storageBucket: 'croomx-34cb0.firebasestorage.app',
  messagingSenderId: '759188857295',
  appId: '1:759188857295:web:cf740da532581b088072ba',
  measurementId: 'G-6R4ZK8X97R',
};

export const app = initializeApp(firebaseConfig);

// Analytics (works on Firebase Hosting / HTTPS)
try {
  getAnalytics(app);
} catch {
  // Ignore on localhost or unsupported environments
}
