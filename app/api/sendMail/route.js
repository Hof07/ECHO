import nodemailer from "nodemailer";

// NOTE: In a real-world setup using React Email (or similar),
// you would need to import the React component and a renderer.
// Example Imports (for context, not runnable here):
// import { render } from '@react-email/render';
// import BirthdayEmailTemplate from './BirthdayEmailTemplate'; 
//
// Since we cannot run React rendering logic in this environment, 
// the function below simulates the output of the React component's HTML.

/**
 * Renders the BirthdayEmailTemplate React component to a static HTML string.
 * This function simulates calling a server-side renderer (like renderToStaticMarkup or @react-email/render).
 * @param {string} recipientName - The name of the recipient.
 * @returns {string} The full HTML content of the email, with styles inlined for compatibility.
 */
function renderBirthdayEmail(recipientName) {
    // --- START: Simulated HTML Output (Based on BirthdayEmailTemplate.jsx) ---
    const PRIMARY_COLOR = "#fa4565";
    const CODE_BG_COLOR = "#1f2937";
    
    // The HTML returned here is the result of server-side rendering the React component.
    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style type="text/css">
    /* Default Desktop Styles (Max width 600px) */
    body { font-family: Inter, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
    .container { max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 0.75rem; overflow: hidden; border-top: 8px solid ${PRIMARY_COLOR}; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
    .header { text-align: center; padding: 32px 24px; background-color: #f9fafb; }
    .title { font-size: 30px; font-weight: 800; color: ${PRIMARY_COLOR}; margin-top: 16px; letter-spacing: -0.025em; }
    .body-content { padding: 24px 32px; }
    .cta-block { background-color: #ecfeff; border-left: 4px solid #22d3ee; padding: 16px; border-radius: 8px; text-align: center; }
    .offer-text { font-size: 24px; font-weight: 700; color: #0891b2; margin-top: 8px; margin-bottom: 8px; }
    .code-block { display: inline-block; color: #ffffff !important; font-size: 24px; font-family: monospace; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); background-color: ${CODE_BG_COLOR}; user-select: all; }
    .button { display: inline-block; color: #ffffff !important; font-weight: 700; font-size: 18px; padding: 12px 32px; border-radius: 9999px; text-decoration: none !important; background-color: ${PRIMARY_COLOR}; transition: background-color 0.3s; }
    .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }

    /* --- Mobile Responsive Styles --- */
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .body-content, .header, .footer {
        padding: 20px 15px !important; /* Reduced horizontal padding for mobile */
      }
      .title {
        font-size: 28px !important; /* Slightly smaller title */
      }
      .offer-text {
        font-size: 22px !important; /* Slightly smaller offer text */
      }
      .code-block {
        font-size: 20px !important; /* Smaller code text */
        padding: 10px 20px !important;
      }
      /* Ensure full width on the outer padding area */
      #outer-wrapper {
        padding: 0 !important;
      }
    }
  </style>
</head>
<body style="font-family: Inter, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0;">
    <!-- Added ID for mobile targeting -->
    <div id="outer-wrapper" style="padding: 16px 32px; display: flex; align-items: center; justify-content: center;">
        <div class="container">
            
            <!-- Header Section -->
            <div class="header">
                <!-- Audio Waveform SVG -->
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${PRIMARY_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="margin: 0 auto;">
                    <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/>
                </svg>
                <h1 class="title">Your Birthday Playlist</h1>
                <p style="font-size: 18px; color: #4b5563; margin-top: 8px;">Celebrate with a special gift from us.</p>
            </div>

            <!-- Body Content -->
            <div class="body-content" style="padding: 24px 32px; line-height: 1.625; color: #4b5563;">
                <p style="font-size: 20px; color: #1f2937; margin-top: 0;">
                    Hey <strong style="color: #1f2937;">${recipientName}</strong>,
                </p>
                
                <p>
                    We noticed your birthday is today! To thank you for being a dedicated listener, we want to give you the gift of unlimited, ad-free music.
                </p>
                <p>
                    Enjoy access to all exclusive tracks, offline downloads, and superior audio quality for the next month, completely on us.
                </p>

                <!-- The Offer / CTA Block -->
                <div class="cta-block" style="margin-top: 24px; margin-bottom: 24px;">
                    <p style="font-size: 14px; font-weight: 500; color: #0e7490;">Your Birthday Perk:</p>
                    <p class="offer-text">
                        1 MONTH FREE Premium Access!
                    </p>
                    <p style="font-size: 14px; color: #0d9488; margin-bottom: 0;">
                        No payment required today. Cancel anytime.
                    </p>
                </div>

                <!-- Coupon Code -->
                <div style="text-align: center; padding-top: 16px; padding-bottom: 16px;">
                    <p style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">Use this code during signup or renewal:</p>
                    <span class="code-block">
                        MUSICWISH24
                    </span>
                </div>

                <!-- Button -->
                <div style="text-align: center; margin-top: 24px;">
                    <a href="https://yourwebsite.com/premium-signup" class="button">
                        Unlock Ad-Free Music!
                    </a>
                </div>
            </div>

            <!-- Footer Section -->
            <div class="footer">
                <p style="margin-bottom: 8px; margin-top: 0;">Happy listening,</p>
                <p style="font-weight: 600; color: #374151; margin-top: 0;">The echo Team</p>
                <p style="margin-top: 16px;">
                    <a href="https://yourwebsite.com/unsubscribe" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> | <a href="https://yourwebsite.com/contact" style="color: #9ca3af; text-decoration: underline;">Help Center</a>
                </p>
            </div>

        </div>
    </div>
</body>
</html>
`;
    // --- END: Simulated HTML Output ---
}


export async function POST(req) {
    try {
        // The endpoint now expects 'to' (email address) and 'recipientName'
        const { to, recipientName } = await req.json();

        if (!to || !recipientName) {
            return Response.json(
                { success: false, error: "Missing 'to' or 'recipientName'" },
                { status: 400 }
            );
        }

        // 1. Generate the HTML content using the template simulation
        const emailHtml = renderBirthdayEmail(recipientName);

        // 2. Define the personalized subject
        const subject = `Happy Birthday, ${recipientName}! Your Gift from echo inside!`;

        // 3. Transporter
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                // Ensure these environment variables are correctly set on your server
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS, 
            },
        });

        // 4. Send mail
        await transporter.sendMail({
            from: `"echo" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: emailHtml, 
        });

        return Response.json({ success: true, message: `Birthday email successfully queued for ${to}` });
    } catch (error) {
        console.error("Email sending error:", error);
        return Response.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}