export async function extractTargetUrl(googleNewsUrl: string): Promise<string> {
  try {
    // Validate and clean up the URL
    let urlToProcess = googleNewsUrl.trim();
    
    // Make sure it's a valid URL
    try {
      new URL(urlToProcess);
    } catch (e) {
      throw new Error('Please enter a valid URL');
    }

    // Make sure it's a Google News URL
    if (!urlToProcess.includes('news.google.com')) {
      throw new Error('Please enter a valid Google News URL');
    }

    // Making a server-side request to fetch the Google News article
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: urlToProcess }),
    });

    // Parse the response
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to extract URL');
    }

    if (!data.targetUrl) {
      throw new Error('Could not extract target URL from this Google News link');
    }

    return data.targetUrl;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}
