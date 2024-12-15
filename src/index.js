import { Client, Databases } from 'node-appwrite';
import { SendGridService } from '@sendgrid/mail';

// This code goes in your GitHub repository for the function

export default async function({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const sendgrid = new SendGridService();
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    const { email, photoSessionId } = JSON.parse(req.payload);

    // Get photo session data
    const photoSession = await databases.getDocument(
      '670bb74a001bfc682ba3',  // Replace with your database ID
      '675ec21d000d21ec9d05',
      photoSessionId
    );

    // Send email using SendGrid
    await sendgrid.send({
      to: email,
      from: 'your-verified-sender@yourdomain.com', // Must be verified in SendGrid
      subject: 'Your Photobooth Pictures Are Ready! 📸',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Your Photos Are Ready! 🎉</h1>
          <p>Thank you for using our photobooth! Here are your photos:</p>
          <div style="margin: 20px 0;">
            ${photoSession.photoUrls.map(url => `
              <div style="margin: 10px 0;">
                <img src="${url}" style="max-width: 100%; border-radius: 8px;" />
              </div>
            `).join('')}
          </div>
          <p>Your photos will be available for download for the next 24 hours.</p>
          <p>We hope you had a great time!</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: 'Photos sent successfully'
    });

  } catch (err) {
    error(err);
    return res.json({
      success: false,
      message: err.message
    }, 500);
  }
}