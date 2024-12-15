import { Client, Databases, Permission, Role } from 'node-appwrite';

export default async function({ req, res, log, error }) {
  try {
    // Define constants inside the function
    const DATABASE_ID = '67589fa1001cb6a993c5';
    const PHOTOS_COLLECTION_ID = '675ec21d000d21ec9d05';

    // Initialize Appwrite client with explicit permissions
    const client = new Client()
      .setEndpoint('https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY)
      .setSelfSigned(); // Add this if you're getting SSL errors

    log('Client initialized with project:', process.env.APPWRITE_FUNCTION_PROJECT_ID);

    // Initialize databases client
    const databases = new Databases(client);

    //if (!process.env.SMTP_FROM_EMAIL) {
    //  throw new Error('SMTP_FROM_EMAIL environment variable is not set');
    //}
    //log('Using sender email:', process.env.SMTP_FROM_EMAIL);

    // Try printing some environment info for debugging
    log('Environment variables:', {
      projectId: process.env.APPWRITE_FUNCTION_PROJECT_ID,
      endpoint: process.env.APPWRITE_ENDPOINT,
      functionId: process.env.APPWRITE_FUNCTION_ID
    });

    log('Starting email function');

    // Get the request data
    const data = JSON.parse(req.body);
    log('Received data:', data);

    if (!data || !data.email || !data.photoSessionId) {
      throw new Error('Missing required fields: email and photoSessionId');
    }

    const { email, photoSessionId, photoUrls } = data;

    // If we have photoUrls directly in the request, use those
    let photos = photoUrls;
    if (!photos || photos.length === 0) {
      log('No photoUrls provided, attempting to fetch from database');
      const photoSession = await databases.getDocument(
        DATABASE_ID,
        PHOTOS_COLLECTION_ID,
        photoSessionId
      );
      photos = photoSession.photoUrls;
    }

    if (!photos || photos.length === 0) {
      throw new Error('No photos found');
    }

    // Create HTML for images
    const imagesHtml = photos
      .map(url => `<div style="margin: 10px 0;"><img src="${url}" style="max-width: 100%; border-radius: 8px;" /></div>`)
      .join('');

    // Create email content without emojis
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Your Photos Are Ready!</h1>
        <p>Thank you for using our photobooth! Here are your photos:</p>
        <div style="margin: 20px 0;">
          ${imagesHtml}
        </div>
        <p>Your photos will be available for download for the next 24 hours.</p>
        <p>We hope you had a great time!</p>
      </div>
    `;

    try {
      log('Attempting to send email with data:', {
        to: email,
        subject: 'Your Photobooth Pictures Are Ready!'
      });
    
      const message = await client.call('post', '/messaging/messages/email', {
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': process.env.APPWRITE_FUNCTION_PROJECT_ID,
          'X-Appwrite-Key': process.env.APPWRITE_API_KEY
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM_EMAIL,
          to: [email],
          subject: 'Your Photobooth Pictures Are Ready!',
          html: emailHtml,
          providerId: '675ed68e0038082702b4' // Updated ID
        })
      });
    
      log('Email sent successfully:', message);
    
      // Update photo session status
      await databases.updateDocument(
        DATABASE_ID,
        PHOTOS_COLLECTION_ID,
        photoSessionId,
        {
          status: 'delivered',
          userEmail: email,
          deliveredAt: new Date().toISOString()
        }
      );
    
      return res.json({
        success: true,
        message: 'Photos sent successfully'
      });
    
    } catch (err) {
      error('Detailed error:', JSON.stringify(err));
      // Move specific database update error handling here
      if (err.code === 'document_update_failed') {
        log('Warning: Could not update document status:', err);
        // Still return success since email was sent
        return res.json({
          success: true,
          message: 'Photos sent successfully but failed to update status'
        });
      }
    
      if (err.message.includes('missing scope')) {
        error('Permission error: Function lacks required messaging permissions');
        throw new Error('Email service configuration error');
      }
      error('Email sending error:', err);
      return res.json({
        success: false,
        message: err.message,
        details: {
          error: err.toString()
        }
      }, 500);
    }

  } catch (err) {
    error('Error in email function:', err);
    return res.json({
      success: false,
      message: err.message,
      details: {
        error: err.toString()
      }
    }, 500);
  }
}