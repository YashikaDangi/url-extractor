import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';

// This route will handle the URL extraction using Puppeteer
export async function POST(request: NextRequest) {
  let browser;
  
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { message: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate that the URL is from Google News
    if (!url.includes('news.google.com')) {
      return NextResponse.json(
        { message: 'Only Google News URLs are supported' },
        { status: 400 }
      );
    }

    // Launch a headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set a user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the URL and wait for redirects to complete
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 // 30 seconds timeout
    });
    
    // Get the final URL after all redirects
    const targetUrl = page.url();
    
    // If we're still on Google News, try to find and click the first link
    if (targetUrl.includes('news.google.com')) {
      // Try to find and click the first news article link
      const articleLinks = await page.$$eval('a[href^="https://"]', (links) => 
        links
          .map(link => link.getAttribute('href'))
          .filter(href => href && !href.includes('google.com'))
      );
      
      if (articleLinks && articleLinks.length > 0) {
        // Use the first external link we found
        return NextResponse.json({ targetUrl: articleLinks[0] });
      }
      
      return NextResponse.json(
        { message: 'Could not find a news article link on the page' },
        { status: 400 }
      );
    }
    
    // Return the target URL
    return NextResponse.json({ targetUrl });
  } catch (error) {
    console.error('Error extracting URL:', error);
    return NextResponse.json(
      { message: 'Failed to extract target URL' },
      { status: 500 }
    );
  } finally {
    // Make sure to close the browser
    if (browser) {
      await browser.close();
    }
  }
}