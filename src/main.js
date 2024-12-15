import { Client, Databases } from 'node-appwrite';

export default async function({ req, res, log, error }) {
  try {
    // Define constants inside the function
    const DATABASE_ID = '67589fa1001cb6a993c5';
    const PHOTOS_COLLECTION_ID = '675ec21d000d21ec9d05';

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint('https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

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

    // Send email using Appwrite's built-in messaging - removed emoji from subject
    const message = await client.call('post', '/messaging/smtp/send', {
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@appwrite.io',  // Make sure this is your configured sender
        to: [email],
        subject: 'Your Photobooth Pictures Are Ready!',
        html: emailHtml
      })
    });

    log('Email sent:', message);

    // Try to update photo session status
    try {
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
    } catch (updateError) {
      log('Warning: Could not update document status:', updateError);
    }

    return res.json({
      success: true,
      message: 'Photos sent successfully'
    });

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