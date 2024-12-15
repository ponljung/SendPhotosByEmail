import { Client, Databases, Functions, Query } from 'node-appwrite';

export default async function({ req, res, log, error }) {
  try {
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

    // Get photo session data
    const photoSession = await databases.getDocument(
      '67589fa1001cb6a993c5',
      '675ec21d000d21ec9d05',
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
      '670bb74a001bfc682ba3',
      '675ec21d000d21ec9d05',
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
    return res.json({
      success: false,
      message: err.message
    }, 500);
  }
}