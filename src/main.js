import { Client, Databases, Functions } from 'node-appwrite';

export default async function({ req, res, log, error }) {
  try {
    // Constants matching the client side
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

    const { email, photoSessionId } = data;

    // Log the IDs we're using
    log('Attempting to fetch document with:', {
      databaseId: DATABASE_ID,
      collectionId: PHOTOS_COLLECTION_ID,
      documentId: photoSessionId
    });

    // Get photo session data
    const photoSession = await databases.getDocument(
      DATABASE_ID,
      PHOTOS_COLLECTION_ID,
      photoSessionId
    );

    log('Retrieved photo session:', photoSession);

    if (!photoSession.photoUrls || photoSession.photoUrls.length === 0) {
      throw new Error('No photos found in session');
    }

    // Create HTML for images
    const imagesHtml = photoSession.photoUrls
      .map(url => `<div style="margin: 10px 0;"><img src="${url}" style="max-width: 100%; border-radius: 8px;" /></div>`)
      .join('');

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Your Photos Are Ready! 🎉</h1>
        <p>Thank you for using our photobooth! Here are your photos:</p>
        <div style="margin: 20px 0;">
          ${imagesHtml}
        </div>
        <p>Your photos will be available for download for the next 24 hours.</p>
        <p>We hope you had a great time!</p>
      </div>
    `;

    // Send email using Appwrite's built-in messaging
    const message = await client.call('post', '/messaging/smtp/send', {
      to: [email],
      subject: 'Your Photobooth Pictures Are Ready! 📸',
      html: emailHtml
    });

    log('Email sent:', message);

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
    error('Error in email function:', err);
    // Include more details in the error response
    return res.json({
      success: false,
      message: err.message,
      details: {
        databaseId: DATABASE_ID,
        collectionId: PHOTOS_COLLECTION_ID,
        error: err.toString()
      }
    }, 500);
  }
}