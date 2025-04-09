import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

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

    console.log('Launching browser in Vercel environment...');
    
    // Initialize chromium with Vercel-specific configuration
    // This is critical for Vercel deployment
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    // Set a user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Use request interception to improve performance
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      // Block unnecessary resources to speed up and reduce memory usage
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to the URL with reasonable timeout
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Using domcontentloaded is faster than networkidle0
      timeout: 15000 // 15 seconds timeout - reduced for serverless environments
    });
    
    // Get the final URL after all redirects
    const targetUrl = page.url();
    
    // If we're already redirected to the original article
    if (!targetUrl.includes('news.google.com')) {
      console.log('Already redirected to target site:', targetUrl);
      return NextResponse.json({ targetUrl });
    }
    
    // We're still on Google News, so extract the article URL
    console.log('Still on Google News, trying to extract article URL');
    
    // Try multiple strategies to find the article URL
    try {
      // Strategy 1: Look for data-n-au attributes (common in Google News)
      const articleUrl1 = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[data-n-au]'));
        for (const link of links) {
          const url = link.getAttribute('data-n-au');
          if (url && !url.includes('google.com')) return url;
        }
        return null;
      });
      
      if (articleUrl1) {
        console.log('Found article URL from data-n-au:', articleUrl1);
        return NextResponse.json({ targetUrl: articleUrl1 });
      }
      
      // Strategy 2: Look for standard links to external sites
      const articleUrl2 = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href^="https://"]'));
        for (const link of links) {
          const url = link.getAttribute('href');
          if (url && !url.includes('google.com')) return url;
        }
        return null;
      });
      
      if (articleUrl2) {
        console.log('Found article URL from external links:', articleUrl2);
        return NextResponse.json({ targetUrl: articleUrl2 });
      }
      
      // Strategy 3: Look for article links via common classes
      const articleUrl3 = await page.evaluate(() => {
        // Common Google News article classes
        const selectors = [
          '.VDXfz a', '.DY5T1d', '.RZIKme', 'article a', 
          'a[aria-label*="article"]', 'h3 > a', 'h4 > a'
        ];
        
        for (const selector of selectors) {
          const links = Array.from(document.querySelectorAll(selector));
          for (const link of links) {
            const url = link.getAttribute('href');
            if (url && !url.includes('google.com') && url.startsWith('http')) {
              return url;
            }
          }
        }
        return null;
      });
      
      if (articleUrl3) {
        console.log('Found article URL from article elements:', articleUrl3);
        return NextResponse.json({ targetUrl: articleUrl3 });
      }
      
    } catch (evalError) {
      console.error('Error during page evaluation:', evalError);
    }
    
    // If we couldn't find a URL, return an error
    return NextResponse.json(
      { message: 'Could not find a news article link on the page' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error extracting URL:', error);
    return NextResponse.json(
      { message: 'Failed to extract target URL: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  } finally {
    // Make sure to close the browser
    if (browser) {
      await browser.close();
    }
  }
}