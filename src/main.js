import { Client, Databases } from 'node-appwrite';
import sgMail from '@sendgrid/mail';

export default async function({ req, res, log, error }) {
  try {
    // Check for payload
    if (!req.payload) {
      error('No payload provided');
      return res.json({
        success: false,
        message: 'No payload provided',
        details: 'Request payload is missing'
      }, 400);
    }

    // Parse payload with error handling
    let payload;
    try {
      payload = JSON.parse(req.payload);
      log('Received payload:', payload);
    } catch (e) {
      error('Invalid JSON payload:', e);
      return res.json({
        success: false,
        message: 'Invalid payload format',
        details: e.message
      }, 400);
    }

    const { email, photoSessionId } = payload;

    // Validate required fields
    if (!email || !photoSessionId) {
      error('Missing required fields');
      return res.json({
        success: false,
        message: 'Missing required fields',
        details: 'Both email and photoSessionId are required'
      }, 400);
    }

    // Initialize Appwrite client with error handling
    if (!process.env.APPWRITE_FUNCTION_PROJECT_ID || !process.env.APPWRITE_API_KEY) {
      error('Missing Appwrite configuration');
      return res.json({
        success: false,
        message: 'Server configuration error',
        details: 'Appwrite credentials not configured'
      }, 500);
    }

    const client = new Client()
      .setEndpoint('https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    // Validate SendGrid configuration
    if (!process.env.SENDGRID_API_KEY) {
      error('SendGrid API key not configured');
      return res.json({
        success: false,
        message: 'Email service configuration error',
        details: 'SendGrid API key not configured'
      }, 500);
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Get photo session with error handling
    let photoSession;
    try {
      photoSession = await databases.getDocument(
        '670bb74a001bfc682ba3',
        '675ec21d000d21ec9d05',
        photoSessionId
      );
      log('Retrieved photo session:', photoSession);
    } catch (dbError) {
      error('Database error:', dbError);
      return res.json({
        success: false,
        message: 'Failed to retrieve photo session',
        details: dbError.message
      }, 500);
    }

    // Validate photo URLs
    if (!photoSession.photoUrls || !Array.isArray(photoSession.photoUrls) || photoSession.photoUrls.length === 0) {
      error('No photos found in session');
      return res.json({
        success: false,
        message: 'Invalid photo session',
        details: 'No photos found in the session'
      }, 400);
    }

    // Send email with error handling
    try {
      const msg = {
        to: email,
        from: process.env.SENDGRID_VERIFIED_SENDER || 'your-verified-sender@yourdomain.com',
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
      };

      log('Sending email...');
      await sgMail.send(msg);
      log('Email sent successfully');

      // Update document status
      await databases.updateDocument(
        '670bb74a001bfc682ba3',
        '675ec21d000d21ec9d05',
        photoSessionId,
        {
          status: 'delivered',
          deliveredAt: new Date().toISOString()
        }
      );

      return res.json({
        success: true,
        message: 'Photos sent successfully'
      });
    } catch (emailError) {
      error('SendGrid error:', emailError);
      return res.json({
        success: false,
        message: 'Failed to send email',
        details: emailError.message
      }, 500);
    }
  } catch (err) {
    error('Unexpected error:', err);
    return res.json({
      success: false,
      message: 'Unexpected error occurred',
      details: err.message
    }, 500);
  }
}