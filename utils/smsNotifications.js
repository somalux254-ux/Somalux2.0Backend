/**
 * SMS Notifications Service using Africa's Talking API
 * For student & landlord notifications
 */

import africastalking from 'africastalking';

// Initialize Africa's Talking
const africastalkingClient = africastalking({
  apiKey: process.env.AFRICASTALKING_API_KEY || '',
  username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
});

const sms = africastalkingClient.SMS;

/**
 * Send SMS notification
 * @param {string} phoneNumber - Recipient phone (format: +254712345678)
 * @param {string} message - SMS text
 */
export const sendSMS = async (phoneNumber, message) => {
  try {
    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+254${phoneNumber.replace(/^0/, '')}`;

    const result = await sms.send({
      to: [formattedPhone],
      message: message,
      from: process.env.AFRICASTALKING_SHORTCODE || null
    });

    console.log('SMS sent successfully:', result);
    return { success: true, result };
  } catch (error) {
    console.error('SMS sending failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify student about booking approval
 */
export const notifyBookingApproved = async (studentPhone, landlordName, propertyTitle) => {
  const message = `✅ : Your booking for "${propertyTitle}" has been APPROVED by ${landlordName}! Check the app for details.`;
  return await sendSMS(studentPhone, message);
};

/**
 * Notify student about booking rejection
 */
export const notifyBookingRejected = async (studentPhone, propertyTitle) => {
  const message = `❌ CampusChumba: Your booking request for "${propertyTitle}" was declined. Browse more options on the app.`;
  return await sendSMS(studentPhone, message);
};

/**
 * Notify landlord about new booking request
 */
export const notifyNewBookingRequest = async (landlordPhone, studentName, propertyTitle) => {
  const message = `🏠 CampusChumba: New booking request from ${studentName} for "${propertyTitle}". Login to approve/reject.`;
  return await sendSMS(landlordPhone, message);
};

/**
 * Notify about payment received
 */
export const notifyPaymentReceived = async (phone, amount, propertyTitle) => {
  const message = `💰 CampusChumba: Payment of KES ${amount.toLocaleString()} received for "${propertyTitle}". Thank you!`;
  return await sendSMS(phone, message);
};

/**
 * Send verification code
 */
export const sendVerificationCode = async (phone, code) => {
  const message = `🔐 CampusChumba Verification Code: ${code}. Valid for 10 minutes. Do not share this code.`;
  return await sendSMS(phone, message);
};

/**
 * Notify about new message in chat
 */
export const notifyNewMessage = async (recipientPhone, senderName, propertyTitle) => {
  const message = `💬 CampusChumba: New message from ${senderName} about "${propertyTitle}". Reply in the app.`;
  return await sendSMS(recipientPhone, message);
};

/**
 * Reminder for rent payment
 */
export const sendRentReminder = async (studentPhone, amount, dueDate, propertyTitle) => {
  const message = `📅 CampusChumba Reminder: Rent of KES ${amount.toLocaleString()} for "${propertyTitle}" is due on ${dueDate}. Please make payment.`;
  return await sendSMS(studentPhone, message);
};

/**
 * Welcome message for new users
 */
export const sendWelcomeSMS = async (phone, name) => {
  const message = `🏠 Welcome to CampusChumba, ${name}! Find your perfect student accommodation near campus. Download the app to get started.`;
  return await sendSMS(phone, message);
};

/**
 * Referral reward notification
 */
export const notifyReferralReward = async (phone, amount, referredName) => {
  const message = `🎉 CampusChumba: You've earned KES ${amount} for referring ${referredName}! Your reward has been credited.`;
  return await sendSMS(phone, message);
};

/**
 * Viewing appointment confirmation
 */
export const confirmViewingAppointment = async (phone, propertyTitle, date, time, landlordPhone) => {
  const message = `📍 CampusChumba: Viewing confirmed for "${propertyTitle}" on ${date} at ${time}. Landlord: ${landlordPhone}. See you there!`;
  return await sendSMS(phone, message);
};

/* 
Environment Variables Needed (.env):

AFRICASTALKING_API_KEY=your_api_key_here
AFRICASTALKING_USERNAME=your_username (use 'sandbox' for testing)
AFRICASTALKING_SHORTCODE=your_shortcode (optional)

Get credentials from: https://account.africastalking.com/
*/

/* 
Install package:
npm install africastalking

Usage Example:
import { notifyBookingApproved, sendVerificationCode } from './utils/smsNotifications.js';

// In your route
await notifyBookingApproved('+254712345678', 'John Doe', 'Modern Bedsitter');
*/
