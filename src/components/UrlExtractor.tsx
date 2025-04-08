'use client';

import { useState, useEffect } from 'react';
import { extractTargetUrl } from '../lib/extractUrl';

export default function UrlExtractor() {
  const [googleNewsUrl, setGoogleNewsUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [recentExtractions, setRecentExtractions] = useState<string[]>([]);

  // Load recent extractions from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('recentExtractions');
    if (saved) {
      try {
        setRecentExtractions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent extractions');
      }
    }
  }, []);

  // Save recent extractions to localStorage when they change
  useEffect(() => {
    if (recentExtractions.length) {
      localStorage.setItem('recentExtractions', JSON.stringify(recentExtractions));
    }
  }, [recentExtractions]);

  const handleExtract = async () => {
    if (!googleNewsUrl) {
      setError('Please enter a Google News URL');
      return;
    }

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const url = await extractTargetUrl(googleNewsUrl);
      setTargetUrl(url);
      
      // Add to recent extractions if not already there
      if (url && !recentExtractions.includes(googleNewsUrl)) {
        setRecentExtractions(prev => [googleNewsUrl, ...prev].slice(0, 5));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract URL');
      setTargetUrl('');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (targetUrl) {
      navigator.clipboard.writeText(targetUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          setError('Failed to copy URL');
        });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleExtract();
    }
  };
  
  const handlePaste = () => {
    navigator.clipboard.readText()
      .then(text => {
        if (text && text.includes('news.google.com')) {
          setGoogleNewsUrl(text);
        } else {
          setShowTooltip(true);
          setTimeout(() => setShowTooltip(false), 3000);
        }
      })
      .catch(err => {
        console.error('Failed to read clipboard:', err);
      });
  };
  
  const handleUseRecent = (url: string) => {
    setGoogleNewsUrl(url);
  };
  
  const handleClear = () => {
    setGoogleNewsUrl('');
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 transition-all duration-300">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-medium text-gray-700">Enter Google News URL</h3>
          <div className="relative">
            <button 
              onClick={() => setShowTooltip(prev => !prev)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute left-6 top-0 w-64 p-2 bg-black text-white text-xs rounded shadow-lg z-10">
                Paste a Google News URL that starts with 'https://news.google.com/'
                <div className="absolute left-0 top-2 -ml-2 w-0 h-0 border-t-2 border-r-2 border-b-2 border-transparent border-r-black"></div>
              </div>
            )}
          </div>
        </div>
        
        <div className="relative">
          <input
            type="text"
            value={googleNewsUrl}
            onChange={(e) => setGoogleNewsUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            // placeholder="https://news.google.com/..."
            className="w-full p-4 pl-4 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          
          <div className="absolute right-2 top-2 flex">
            {googleNewsUrl && (
              <button
                onClick={handleClear}
                className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                title="Clear input"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
            <button
              onClick={handlePaste}
              className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
              title="Paste from clipboard"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="mt-4">
          <button
            onClick={handleExtract}
            disabled={loading || !googleNewsUrl}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium transition-colors ${
              loading || !googleNewsUrl 
                ? 'bg-blue-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Extracting Target URL...
              </div>
            ) : (
              'Extract Target URL'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md animate-fadeIn">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {targetUrl && (
        <div className="mb-6 transform transition-all duration-300 animate-fadeIn">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-blue-800">Target URL Extracted!</h2>
              <button
                onClick={handleCopy}
                className={`flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
                  copied 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                    </svg>
                    Copy URL
                  </>
                )}
              </button>
            </div>
            <div className="bg-white rounded-md p-3 border border-blue-100 mb-4">
              <a 
                href={targetUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline break-words block text-sm font-mono"
              >
                {targetUrl}
              </a>
            </div>
            <div className="flex justify-end">
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                Visit Website
              </a>
            </div>
          </div>
        </div>
      )}
      
      
        <div className="text-sm text-gray-600 mt-2 flex items-center">
          <svg className="h-4 w-4 mr-1 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
          </svg>
          <p>Processing may take a few seconds as it needs to fully load the page.</p>
        </div>
    </div>
  );
}

