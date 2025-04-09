// Environment configuration helper
const environment = {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    
    // Browser timeout settings
    browserTimeouts: {
      navigation: 20000, // 20 seconds for page navigation
      element: 5000,     // 5 seconds for element finding
    },
    
    // Platform detection (useful for platform-specific adjustments if needed)
    platform: {
      isVercel: typeof process.env.VERCEL !== 'undefined',
      isHeroku: typeof process.env.DYNO !== 'undefined',
      isNetlify: typeof process.env.NETLIFY !== 'undefined',
    },
    
    // Helper method to get appropriate timeout for current environment
    getTimeout(type: 'navigation' | 'element'): number {
      // In serverless environments, use shorter timeouts
      const isServerless = environment.platform.isVercel || environment.platform.isNetlify;
      
      if (isServerless) {
        return type === 'navigation' ? 15000 : 3000;
      }
      
      return environment.browserTimeouts[type];
    }
  };
  
  export default environment;