import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { env } from "../config/env.js";

const ses = new SESClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const OtpService = {
  generate(length = 6) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
  },

  getExpiry(minutes = 5) {
    return new Date(Date.now() + minutes * 60 * 1000);
  },

  getResendWindow(seconds = 60) {
    return new Date(Date.now() + seconds * 1000);
  },

  isExpired(date?: Date | null) {
    if (!date) return true;
    return date.getTime() < Date.now();
  },

  async send(email: string, otp: string) {
    const command = new SendEmailCommand({
      Source: env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: "OTP Verification",
        },
        Body: {
          Html: {
            Data: `
              <div style="font-family: Arial, sans-serif;">
                <h2>OTP Verification</h2>
                <p>Your OTP is:</p>
                <div style="font-size: 24px; font-weight: bold; letter-spacing: 6px;">${otp}</div>
                <p>This OTP expires in 5 minutes.</p>
              </div>
            `,
          },
          Text: {
            Data: `Your OTP is ${otp}. This OTP expires in 5 minutes.`,
          },
        },
      },
    });

    await ses.send(command);
  },
};