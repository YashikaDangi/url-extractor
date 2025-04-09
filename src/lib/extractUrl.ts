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
      cache: 'no-store', // Disable caching for this request
    });

    // Check if there was a network error
    if (!response) {
      throw new Error('Network error - unable to connect to extraction service');
    }

    // Get response data (even if it's an error)
    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      throw new Error(`Invalid response from server: ${response.statusText}`);
    }
    
    // Check for error response
    if (!response.ok) {
      throw new Error(data?.message || `Error ${response.status}: ${response.statusText}`);
    }

    // Check if we have a valid target URL
    if (!data.targetUrl) {
      throw new Error('No target URL was found in this Google News link');
    }

    return data.targetUrl;
  } catch (error) {
    console.error('Error in extractTargetUrl:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}