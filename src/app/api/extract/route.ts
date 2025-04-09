import { NextRequest, NextResponse } from 'next/server';
import { Browser, PuppeteerLaunchOptions } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// This route will handle the URL extraction using Puppeteer
export async function POST(request: NextRequest) {
  let browser: Browser | undefined;
  
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

    console.log('Launching browser with chromium...');
    
    // Get the executable path for Chromium
    const executablePath = await chromium.executablePath();
    
    // Browser launch options with the new headless mode
    const options: PuppeteerLaunchOptions = {
      args: [
        ...chromium.args,
        '--disable-web-security', // Disable CORS to help with some extractions
        '--disable-features=IsolateOrigins,site-per-process' // Helps with frame navigation
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: "new",  // Use the new headless mode
      ignoreHTTPSErrors: true
    };
    
    // Launch the browser
    browser = await puppeteer.launch(options);
    
    const page = await browser.newPage();
    
    // Set a more modern user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    
    // Use request interception to improve performance - but allow more resources than before
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      // Block only heavy resources to speed up but allow CSS and fonts
      if (['image', 'media', 'font'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to the URL with reasonable timeout and wait for content
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 // 30 seconds timeout - increased for better reliability
    });
    
    // Ensure page had enough time to render
    await page.waitForTimeout(2000);
    
    // Get the final URL after all redirects
    const targetUrl = page.url();
    
    // If we're already on the target site, just return that URL
    if (!targetUrl.includes('news.google.com')) {
      console.log('Already redirected to target site:', targetUrl);
      return NextResponse.json({ targetUrl });
    }
    
    console.log('Still on Google News, extracting article URL with enhanced methods');
    
    // Try direct URL extraction from the meta tags first (often contains the original URL)
    try {
      const metaUrl = await page.evaluate(() => {
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink && canonicalLink.getAttribute('href')) {
          return canonicalLink.getAttribute('href');
        }
        
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl && ogUrl.getAttribute('content')) {
          return ogUrl.getAttribute('content');
        }
        
        return null;
      });
      
      if (metaUrl && !metaUrl.includes('news.google.com')) {
        console.log('Found URL in meta tags:', metaUrl);
        return NextResponse.json({ targetUrl: metaUrl });
      }
    } catch (metaErr) {
      console.log('Meta extraction failed:', metaErr);
    }
    
    // Check for redirect or refresh parameters in the URL
    try {
      const currentUrl = new URL(targetUrl);
      const redirectParam = currentUrl.searchParams.get('url');
      if (redirectParam && !redirectParam.includes('news.google.com')) {
        console.log('Found URL in redirect parameter:', redirectParam);
        return NextResponse.json({ targetUrl: redirectParam });
      }
    } catch (urlErr) {
      console.log('URL param extraction failed:', urlErr);
    }

    // Enhanced version of DOM scraping strategies
    // First, get detailed information about all links on the page
    const linkDetails = await page.evaluate(() => {
      // Helper to check if a string could be a real URL
      const looksLikeUrl = (str: string | null) => {
        return str && 
               str.length > 10 && 
               (str.startsWith('http') || str.startsWith('/'));
      };
      
      // Get all elements that might be article links
      const allElements = Array.from(document.querySelectorAll('a'));
      
      return allElements.map(link => {
        // Get all possible URL sources
        const href = link.getAttribute('href');
        const dataUrl = link.getAttribute('data-n-au') || link.getAttribute('data-n-href');
        const dataTarget = link.getAttribute('data-target-url');
        const ariaLabel = link.getAttribute('aria-label') || '';
        const onclick = link.getAttribute('onclick') || '';
        const innerText = link.innerText.trim();
        const classes = Array.from(link.classList).join(' ');
        
        // For Google News, check if element looks like a news link
        const isArticleLink = ariaLabel.includes('article') || 
                           classes.includes('VDXfz') || 
                           classes.includes('DY5T1d') ||
                           classes.includes('RZIKme') ||
                           innerText.length > 30;
      
        return {
          href,
          dataUrl,
          dataTarget,
          isArticleLink,
          // Extract URLs from onclick handlers
          onclickUrls: onclick.match(/https?:\/\/[^'"\s)]+/g) || []
        };
      }).filter(item => {
        // Keep only likely article links or those with URLs
        return item.isArticleLink || 
              looksLikeUrl(item.href) || 
              looksLikeUrl(item.dataUrl) || 
              looksLikeUrl(item.dataTarget) ||
              item.onclickUrls.length > 0;
      });
    });
    
    console.log(`Found ${linkDetails.length} potential article links`);
    
    // Extract and prioritize URLs from the link details
    const extractedUrls: string[] = [];
    
    // Process all potential sources of URLs
    for (const link of linkDetails) {
      // Extract from dataUrl first (most reliable for Google News)
      if (link.dataUrl && !link.dataUrl.includes('google.com') && !extractedUrls.includes(link.dataUrl)) {
        extractedUrls.push(link.dataUrl);
      }
      
      // Then from dataTarget
      if (link.dataTarget && !link.dataTarget.includes('google.com') && !extractedUrls.includes(link.dataTarget)) {
        extractedUrls.push(link.dataTarget);
      }
      
      // Then from standard href
      if (link.href && !link.href.includes('google.com') && !extractedUrls.includes(link.href)) {
        // Fix relative URLs
        if (link.href.startsWith('/')) {
          const baseUrl = new URL(url);
          extractedUrls.push(`${baseUrl.origin}${link.href}`);
        } else if (link.href.startsWith('http')) {
          extractedUrls.push(link.href);
        }
      }
      
      // Finally check onclick URLs
      for (const onclickUrl of link.onclickUrls) {
        if (!onclickUrl.includes('google.com') && !extractedUrls.includes(onclickUrl)) {
          extractedUrls.push(onclickUrl);
        }
      }
    }
    
    console.log(`Extracted ${extractedUrls.length} URLs from DOM`);
    
    // If we found valid URLs, return the first one
    if (extractedUrls.length > 0) {
      console.log('Using URL found through DOM extraction:', extractedUrls[0]);
      return NextResponse.json({ targetUrl: extractedUrls[0] });
    }
    
    // If DOM extraction failed, try the click approach with more flexibility
    console.log('DOM extraction failed, trying interactive approach');
    
    // Enhanced click strategy
    // For Google News, we'll try to click on links that look like news articles
    try {
      // Let's look for visual elements that are likely to be article links
      const clickableSelectors = [
        'article a', 
        'a[aria-label*="article"]',
        '.VDXfz', // Common Google News article class
        '.DY5T1d', // Another common Google News class
        '.RZIKme', // Another potential class
        'h3 > a', // Article headlines
        'h4 > a', // Smaller headlines
        'a[jsname]', // Google news links often have jsname attribute
        'a.ipQwMb', // Another Google News class
        '[role="article"] a', // Semantic article elements  
        'a:has(h3)', // Links containing headlines
        'a:has(h4)'  // Links containing smaller headlines
      ];
      
      // Try each selector
      for (const selector of clickableSelectors) {
        console.log(`Looking for elements matching: ${selector}`);
        
        const elements = await page.$$(selector);
        console.log(`Found ${elements.length} elements for selector: ${selector}`);
        
        if (elements.length > 0) {
          // Try clicking each element until we get a good result
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            try {
              console.log(`Attempting to click element ${i+1} of ${Math.min(elements.length, 3)}`);
              
              // Get any href attribute before clicking
              const href = await page.evaluate(el => el.getAttribute('href'), elements[i]);
              
              if (href && !href.includes('google.com') && href.startsWith('http')) {
                console.log(`Element has direct href: ${href}`);
                return NextResponse.json({ targetUrl: href });
              }
              
              // Try to click and wait for navigation
              await Promise.all([
                page.waitForNavigation({ timeout: 8000, waitUntil: 'domcontentloaded' }),
                elements[i].click()
              ]);
              
              // Get the new URL after clicking
              const newUrl = page.url();
              console.log(`After click, new URL is: ${newUrl}`);
              
              if (!newUrl.includes('news.google.com')) {
                return NextResponse.json({ targetUrl: newUrl });
              }
              
              // If we're still on Google News, go back and try the next element
              await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 });
            } catch (elementClickErr) {
              console.log(`Error clicking element ${i+1}:`, elementClickErr);
              // Continue with the next element
            }
          }
        }
      }
    } catch (clickErr) {
      console.error('Interactive click approach failed:', clickErr);
    }
    
    // Last resort: Try to extract URL from network requests
    try {
      console.log('Trying to extract URL from network requests');
      
      // Enable request interception to monitor external URLs
      await page.setRequestInterception(false);  // Disable current interception
      
      // Create a list to store external URLs requested
      const externalUrls: string[] = [];
      
      // Monitor all requests
      page.on('request', request => {
        const reqUrl = request.url();
        if (reqUrl && !reqUrl.includes('google.com') && reqUrl.startsWith('http')) {
          externalUrls.push(reqUrl);
        }
      });
      
      // Reload the page to capture new requests
      await page.reload({ waitUntil: 'networkidle0', timeout: 10000 });
      
      // Wait a bit for all requests to be processed
      await page.waitForTimeout(2000);
      
      console.log(`Captured ${externalUrls.length} external URLs from network requests`);
      
      // Filter for likely article URLs (exclude common trackers, analytics, etc)
      const potentialArticleUrls = externalUrls.filter(url => {
        return !url.includes('google-analytics.com') && 
               !url.includes('googletagmanager.com') && 
               !url.includes('googleapis.com') &&
               !url.includes('gstatic.com') &&
               !url.includes('doubleclick.net');
      });
      
      if (potentialArticleUrls.length > 0) {
        console.log('Found potential article URL from network requests:', potentialArticleUrls[0]);
        return NextResponse.json({ targetUrl: potentialArticleUrls[0] });
      }
    } catch (networkErr) {
      console.error('Network request monitoring failed:', networkErr);
    }
    
    // If all methods fail
    return NextResponse.json(
      { message: 'Could not find a news article link on the page. The Google News format may have changed.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error extracting URL:', error);
    return NextResponse.json(
      { message: 'Failed to extract target URL: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  } finally {
    // Make sure to close the browser to prevent memory leaks
    if (browser) {
      await browser.close();
    }
  }
}