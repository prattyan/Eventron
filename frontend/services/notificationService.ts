import { RegistrationStatus } from '../types';

// In a real application, this would call a backend endpoint or a service like EmailJS / SendGrid.
// For this demo, we simulate the network delay and log the email content.

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

// ... (keep helper functions)

const simulateSendEmail = async (payload: EmailPayload): Promise<boolean> => {
  console.group('📧 Email Simulation');
  console.log(`To: ${payload.to}`);
  console.log(`Subject: ${payload.subject}`);
  console.log(`Body: \n${payload.body}`);
  console.groupEnd();

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  return true;
};

export const sendStatusUpdateEmail = async (
  toEmail: string,
  participantName: string,
  eventTitle: string,
  status: RegistrationStatus
): Promise<boolean> => {
  const isApproved = status === RegistrationStatus.APPROVED;
  const subject = isApproved
    ? `Confirmation: You're going to ${eventTitle}!`
    : `Update regarding your registration for ${eventTitle}`;

  const body = isApproved
    ? `Dear ${participantName},

We are thrilled to inform you that your registration for "${eventTitle}" has been APPROVED!

You can now view your digital ticket in the "My Tickets" section of the Eventron app. Please present your QR code at the venue for entry.

We look forward to seeing you there!

Best regards,
The Eventron Team`
    : `Dear ${participantName},

Thank you for your interest in "${eventTitle}".

Unfortunately, we are unable to approve your registration at this time. This may be due to capacity limits or specific event criteria.

We hope to see you at future events.

Best regards,
The Eventron Team`;

  return simulateSendEmail({ to: toEmail, subject, body });
};

export const sendReminderEmail = async (
  toEmail: string,
  participantName: string,
  eventTitle: string,
  eventDate: string,
  location: string,
  userId?: string, // Added userId
  eventId?: string, // Added eventId
  notifyFn?: (n: any) => Promise<any> // notify function
): Promise<boolean> => {
  const formattedDate = new Date(eventDate).toLocaleString();

  const subject = `Reminder: Upcoming Event - ${eventTitle}`;

  const body = `Dear ${participantName},

This is a friendly reminder that you are registered for "${eventTitle}".

📅 Date: ${formattedDate}
📍 Location: ${location}

Don't forget to have your QR code ticket ready for check-in upon arrival. You can access it via the "My Tickets" tab in the app.

Safe travels!

Best regards,
The Eventron Team`;

  // 1. Send In-App Notification (if userId provided and notifyFn available)
  if (userId && notifyFn) {
    await notifyFn({
      userId: userId,
      message: `Reminder: You have an upcoming event "${eventTitle}" on ${formattedDate}.`,
      type: 'info',
      eventId: eventId,
      read: false,
      createdAt: new Date().toISOString()
    });
  }

  // 2. Try to Send Push Notification (if active)
  if (userId) {
    try {
      await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: subject,
          message: `Don't forget: ${eventTitle} is coming up on ${formattedDate}!`
        })
      });
    } catch (e) {
      console.error("Failed to trigger push notification", e);
    }
  }

  return simulateSendEmail({ to: toEmail, subject, body });
};


const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async (userId: string) => {
  if (!('serviceWorker' in navigator)) {
    console.warn("Service Worker not supported");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn("Notification permission denied");
    return;
  }

  const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC) {
    console.error("VAPID Public Key not found");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
    }

    await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        subscription
      })
    });
    console.log("Push subscription sent to backend");
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
  }
};
