import { create } from 'ipfs-http-client';
import { ICredentialMetadata } from '../types';
import { IPFSHTTPClient } from 'ipfs-http-client/types/src/types';

class IPFSService {
  private client: IPFSHTTPClient | null = null;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const host = process.env.IPFS_HOST || 'ipfs.infura.io';
      const port = parseInt(process.env.IPFS_PORT || '5001');
      const protocol = 'https';

      const projectId = process.env.IPFS_PROJECT_ID;
      const projectSecret = process.env.IPFS_PROJECT_SECRET;

      if (!projectId || !projectSecret) {
        console.warn(
          'IPFS project credentials not found. Using local IPFS node if available.'
        );
        this.client = create({
          host: 'localhost',
          port: 5001,
          protocol: 'http',
        });
      } else {
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
      }
      console.log('🚀 IPFS Service initialized');
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
    try {
      if (!this.client) {
        await this.initializeClient();
      }
      if (!this.client) {
        throw new Error('IPFS client not available');
      }

      const { cid } = await this.client.add(JSON.stringify(metadata, null, 2));
      return cid.toString();
    } catch (error) {
      console.error('IPFS metadata upload error:', error);
      throw new Error('Failed to upload metadata to IPFS');
    }
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
