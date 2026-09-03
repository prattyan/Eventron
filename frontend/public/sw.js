/* eslint-disable no-restricted-globals */
// Service Worker for Push Notifications

self.addEventListener('push', function (event) {
    if (event.data) {
        try {
            const data = event.data.json();
            const options = {
                body: data.body,
                icon: data.icon || '/icon-192x192.png',
                badge: '/badge.png',
                vibrate: [100, 50, 100],
                data: {
                    url: data.url || '/'
                }
            };

            event.waitUntil(
                self.registration.showNotification(data.title, options)
            );
        } catch (e) {
            console.error('Error parsing push data', e);
        }
    } else {
        console.log('Push event but no data');
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
