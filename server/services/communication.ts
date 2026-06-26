/**
 * Communication Service
 * Handles delivery of SMS and Email notifications and records every attempt to
 * the communication log. No real provider is wired yet, so messages are
 * recorded with status "pending" (queued) rather than falsely reported as
 * delivered. Set TWILIO/SENDGRID env vars and implement send* to go live.
 */
import { createCommunicationLog } from "../db";

export interface MessagePayload {
  organizationId: number;
  recipientId: number;
  to: string; // Phone number or Email address
  subject?: string;
  content: string;
  type: 'sms' | 'email';
}

export class CommunicationService {
  /** Whether a real delivery provider is configured. None yet → false. */
  static hasProvider(): boolean {
    return Boolean(process.env.TWILIO_AUTH_TOKEN || process.env.SENDGRID_API_KEY);
  }

  /**
   * Sends an SMS message to a recipient.
   * In production, this would use the Twilio API.
   */
  static async sendSMS(payload: MessagePayload): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[SMS Service] Sending SMS to ${payload.to}: ${payload.content}`);
    
    // Simulate API call to Twilio
    // const client = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    // const message = await client.messages.create({ body: payload.content, from: '+1234567890', to: payload.to });
    
    return { success: true, messageId: `sms_${Math.random().toString(36).substr(2, 9)}` };
  }

  /**
   * Sends an Email message to a recipient.
   * In production, this would use SendGrid, AWS SES, or Mailgun.
   */
  static async sendEmail(payload: MessagePayload): Promise<{ success: boolean; messageId?: string }> {
    console.log(`[Email Service] Sending Email to ${payload.to} with subject: ${payload.subject}`);
    
    // Simulate API call to Email Provider
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to: payload.to, from: 'noreply@childflow.com', subject: payload.subject, text: payload.content });
    
    return { success: true, messageId: `email_${Math.random().toString(36).substr(2, 9)}` };
  }

  /**
   * Unified method to send a message and record it to the communication log.
   * Without a configured provider the row is stored as "pending" (queued) and
   * `delivered` is false — callers must not claim the message was delivered.
   */
  static async sendMessage(payload: MessagePayload) {
    const delivered = this.hasProvider();
    let providerMessageId: string | undefined;
    if (delivered) {
      const result = payload.type === 'sms' ? await this.sendSMS(payload) : await this.sendEmail(payload);
      providerMessageId = result.messageId;
    }
    const log = await createCommunicationLog({
      organizationId: payload.organizationId,
      recipientId: payload.recipientId,
      type: payload.type,
      subject: payload.subject ?? null,
      content: payload.content,
      status: delivered ? "sent" : "pending",
      providerMessageId: providerMessageId ?? null,
    });
    return { success: true, delivered, status: delivered ? "sent" : "pending", id: log.id };
  }
}
