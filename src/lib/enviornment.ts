// Environment configuration helper
const environment = {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    
    // Browser timeout settings optimized for serverless
    browserTimeouts: {
      navigation: 15000, // 15 seconds for page navigation (reduced for Vercel)
      element: 3000,     // 3 seconds for element finding
    },
    
    // Platform detection
    platform: {
      isVercel: typeof process.env.VERCEL !== 'undefined',
      isHeroku: typeof process.env.DYNO !== 'undefined',
      isNetlify: typeof process.env.NETLIFY !== 'undefined',
    },
    
    // Helper method to get appropriate timeout for current environment
    getTimeout(type: 'navigation' | 'element'): number {
      // In serverless environments, use shortest timeouts
      if (environment.platform.isVercel) {
        return type === 'navigation' ? 10000 : 2000;
      }
      
      return environment.browserTimeouts[type];
    }
  };
  
  export default environment;