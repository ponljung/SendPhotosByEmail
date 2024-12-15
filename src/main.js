import { Client, Databases } from 'node-appwrite';
import sgMail from '@sendgrid/mail';

export default async function({ req, res, log, error }) {
  // Initialize Appwrite client
  const client = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);
  
  // Validate SendGrid API key
  if (!process.env.SENDGRID_API_KEY) {
    error('SendGrid API key is not configured');
    return res.json({
      success: false,
      message: 'Email service configuration error'
    }, 500);
  }
  
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    // Validate payload
    if (!req.payload) {
      throw new Error('No payload provided');
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(req.payload);
    } catch (parseError) {
      throw new Error(`Invalid JSON payload: ${parseError.message}`);
    }

    const { email, photoSessionId } = parsedPayload;
    
    // Validate required fields
    if (!email || !photoSessionId) {
      throw new Error('Missing required fields: email and photoSessionId are required');
    }

    log('Processing email request:', { email, photoSessionId });

    // Get photo session data with error handling
    let photoSession;
    try {
      photoSession = await databases.getDocument(
        '670bb74a001bfc682ba3',
        '675ec21d000d21ec9d05',
        photoSessionId
      );
    } catch (dbError) {
      error('Database error:', dbError);
      throw new Error(`Failed to retrieve photo session: ${dbError.message}`);
    }

    log('Retrieved photo session:', photoSession);

    // Validate photo URLs
    if (!photoSession.photoUrls || !Array.isArray(photoSession.photoUrls) || photoSession.photoUrls.length === 0) {
      throw new Error('No photo URLs found in the session');
    }

    // Prepare email
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

    log('Attempting to send email with configuration:', {
      to: email,
      from: msg.from,
      subject: msg.subject,
      photoCount: photoSession.photoUrls.length
    });

    // Send email with error handling
    try {
      await sgMail.send(msg);
      log('Email sent successfully');
    } catch (emailError) {
      error('SendGrid error:', emailError);
      if (emailError.response) {
        error('SendGrid error details:', emailError.response.body);
      }
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    // Update photo session status with error handling
    try {
      await databases.updateDocument(
        '670bb74a001bfc682ba3',
        '675ec21d000d21ec9d05',
        photoSessionId,
        {
          status: 'delivered',
          deliveredAt: new Date().toISOString()
        }
      );
    } catch (updateError) {
      error('Failed to update photo session status:', updateError);
      // Don't throw here since email was sent successfully
      log('Warning: Photo session status update failed but email was sent');
    }

    return res.json({
      success: true,
      message: 'Photos sent successfully'
    });
    
  } catch (err) {
    error('Error in SendPhotosByEmail:', {
      message: err.message,
      stack: err.stack,
      payload: req.payload
    });
    
    return res.json({
      success: false,
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, 500);
  }
}