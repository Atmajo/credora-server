import { create, IPFSHTTPClient } from 'ipfs-http-client';
import { ICredentialMetadata } from '../types';

class IPFSService {
  private client: IPFSHTTPClient | null = null;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const host = process.env.IPFS_HOST || 'ipfs.infura.io';
      const port = parseInt(process.env.IPFS_PORT || '5001');
      
      const projectId = process.env.IPFS_PROJECT_ID;
      const projectSecret = process.env.IPFS_PROJECT_SECRET;

      // Check if using placeholder/invalid credentials or localhost
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      const hasValidCredentials = projectId && projectSecret && 
        projectId !== 'your_ipfs_project_id_here' && 
        projectSecret !== 'your_ipfs_project_secret_here';

      if (isLocalhost || !hasValidCredentials) {
        console.warn(
          'IPFS project credentials not found or using localhost. Using local IPFS node if available.'
        );
        this.client = create({
          host: 'localhost',
          port: 5001,
          protocol: 'http',
        });
        console.log('🚀 IPFS Service initialized with local node');
      } else {
        // Use HTTPS for remote services like Infura
        const protocol = isLocalhost ? 'http' : 'https';
        this.client = create({
          host,
          port,
          protocol,
          headers: {
            authorization: `Basic ${Buffer.from(
              `${projectId}:${projectSecret}`
            ).toString('base64')}`,
          },
        });
        console.log('🚀 IPFS Service initialized with remote service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize IPFS client:', error);
      // Fallback to mock mode
      this.client = null;
    }
  }

  /**
   * Upload metadata to IPFS
   */
  public async uploadMetadata(metadata: ICredentialMetadata): Promise<string> {
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        if (!this.client) {
          await this.initializeClient();
        }
        if (!this.client) {
          throw new Error('IPFS client not available');
        }

        console.log(`📤 Uploading metadata to IPFS (attempt ${attempt + 1})...`);
        const { cid } = await this.client.add(JSON.stringify(metadata, null, 2));
        const cidString = cid.toString();
        console.log('✅ Metadata uploaded to IPFS with CID:', cidString);
        return cidString;
      } catch (error) {
        console.error(`IPFS metadata upload error (attempt ${attempt + 1}):`, error);
        
        if (attempt === maxAttempts - 1) {
          throw new Error('Failed to upload metadata to IPFS after multiple attempts');
        }
        
        // Reset client for retry
        this.client = null;
        attempt++;
        console.log('🔄 Retrying IPFS upload...');
      }
    }
    
    throw new Error('Failed to upload metadata to IPFS');
  }

  /**
   * Upload file to IPFS
   */
  public async uploadFile(
    fileBuffer: Buffer,
    filename: string
  ): Promise<string> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      const { cid } = await this.client.add({
        path: filename,
        content: fileBuffer,
      });
      return cid.toString();
    } catch (error) {
      console.error('IPFS file upload error:', error);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  /**
   * Upload multiple files to IPFS
   */
  public async uploadFiles(
    files: Array<{ buffer: Buffer; filename: string }>
  ): Promise<string[]> {
    try {
      const results: string[] = [];
      for (const file of files) {
        const cid = await this.uploadFile(file.buffer, file.filename);
        results.push(cid);
      }
      return results;
    } catch (error) {
      console.error('IPFS batch upload error:', error);
      throw new Error('Failed to upload files to IPFS');
    }
  }

  /**
   * Retrieve metadata from IPFS
   */
  public async getMetadata(hash: string): Promise<ICredentialMetadata> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(hash)) {
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data) as ICredentialMetadata;
    } catch (error) {
      console.error('IPFS retrieval error:', error);
      throw new Error('Failed to retrieve metadata from IPFS');
    }
  }

  /**
   * Retrieve file from IPFS
   */
  public async getFile(hash: string): Promise<Buffer> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of this.client.cat(hash)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('IPFS file retrieval error:', error);
      throw new Error('Failed to retrieve file from IPFS');
    }
  }

  /**
   * Check if content exists on IPFS
   */
  public async exists(hash: string): Promise<boolean> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      // Try to get the first chunk
      for await (const _ of this.client.cat(hash)) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pin content to ensure it stays available
   */
  public async pinContent(hash: string): Promise<void> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      await this.client.pin.add(hash);
    } catch (error) {
      console.error('IPFS pin error:', error);
      throw new Error('Failed to pin content to IPFS');
    }
  }

  /**
   * Unpin content
   */
  public async unpinContent(hash: string): Promise<void> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      await this.client.pin.rm(hash);
    } catch (error) {
      console.error('IPFS unpin error:', error);
      throw new Error('Failed to unpin content from IPFS');
    }
  }

  /**
   * Get IPFS stats
   */
  public async getStats(): Promise<any> {
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      return await this.client.stats.bitswap();
    } catch (error) {
      console.error('IPFS stats error:', error);
      throw new Error('Failed to get IPFS stats');
    }
  }

  /**
   * Get public IPFS URL
   */
  public getPublicUrl(hash: string): string {
    return `https://ipfs.io/ipfs/${hash}`;
  }

  /**
   * Get gateway URL with custom gateway
   */
  public getGatewayUrl(
    hash: string,
    gateway: string = 'https://ipfs.io'
  ): string {
    return `${gateway}/ipfs/${hash}`;
  }
}

// Export singleton instance
export default new IPFSService();
