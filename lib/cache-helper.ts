import { LRUCache } from 'lru-cache';

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Create a cache instance for secrets
const secretsCache = new LRUCache<string, string>({
  max: 100,               // Maximum number of secrets to cache
  ttl: 1000 * 60 * 15,    // Expire after 15 minutes
  allowStale: false,      // Don't serve stale data
});

/**
 * Helper for fetching and caching secrets
 * This helps reduce API calls to AWS Secrets Manager
 */
export class SecretHelper {
  // Get a secret value with caching
  static async getSecretValue(
    secretId: string, 
    region: string = 'us-east-1' 
  ): Promise<string> {
    const cacheKey = `secret:${secretId}:${region}`;
    
    // Check if result is in cache
    const cachedValue = secretsCache.get(cacheKey);
    if (cachedValue) {
      console.log(`Using cached secret for: ${secretId}`);
      return cachedValue;
    }
    
    // If not in cache, make the AWS API call
    console.log(`Fetching secret from AWS: ${secretId}`);
    
    try {
      
      // In prod, just use AWS SDK for security
      const result = await fetchSecretFromAWS(secretId, region);
      
      // Store in cache for future use
      secretsCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`Error fetching secret ${secretId}:`, error);
      throw error;
    }
  }
}

// Get Secret
async function fetchSecretFromAWS(secretId: string, region: string): Promise<string> {

   const client = new SecretsManagerClient({ region });
   const command = new GetSecretValueCommand({ SecretId: secretId });
   const response = await client.send(command);
   return response.SecretString || '';
 
}