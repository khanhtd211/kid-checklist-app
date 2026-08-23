const CACHE_NAME = 'kid-checklist-v31';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Nhận thông báo đẩy (Firebase Cloud Messaging) khi app đã đóng.
// Bọc try/catch để nếu không tải được thư viện (mạng chặn) thì phần cache/offline
// ở trên vẫn hoạt động bình thường, chỉ riêng thông báo đẩy là không có.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyADHMVXLZiiNt23HKygAZHfbVPE9BmdKHE",
    authDomain: "kid-checklist-14544.firebaseapp.com",
    projectId: "kid-checklist-14544",
    storageBucket: "kid-checklist-14544.firebasestorage.app",
    messagingSenderId: "638904549868",
    appId: "1:638904549868:web:700bb8b98ec82550c7c0c9"
  });
  firebase.messaging();
} catch (e) {
  // Không tải được thư viện thông báo — bỏ qua, không ảnh hưởng phần còn lại của app.
}
