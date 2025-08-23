import QRCode from 'qrcode';

interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
}

interface QRCodeResult {
  tokenId: string;
  qrCode: string;
  verificationUrl: string;
}

class QRService {
  private readonly defaultOptions: QRCodeOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
    type: 'image/png',
    quality: 0.92,
  };

  /**
   * Generate QR code for a single credential
   */
  public async generateQR(
    tokenId: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const verificationUrl = this.getVerificationUrl(tokenId);
      const qrOptions = { ...this.defaultOptions, ...options };

      const qrDataURL = await QRCode.toDataURL(verificationUrl, qrOptions);
      return qrDataURL;
    } catch (error) {
      console.error('QR generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate QR codes for multiple credentials
   */
  public async generateBatchQR(
    tokenIds: string[],
    options: QRCodeOptions = {}
  ): Promise<QRCodeResult[]> {
    try {
      const qrCodes = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const qrCode = await this.generateQR(tokenId, options);
          return {
            tokenId,
            qrCode,
            verificationUrl: this.getVerificationUrl(tokenId),
          };
        })
      );
      return qrCodes;
    } catch (error) {
      console.error('Batch QR generation error:', error);
      throw new Error('Failed to generate batch QR codes');
    }
  }

  /**
   * Generate QR code as SVG string
   */
  public async generateQRSVG(
    tokenId: string,
    options: Partial<QRCodeOptions> = {}
  ): Promise<string> {
    try {
      const verificationUrl = this.getVerificationUrl(tokenId);
      const qrOptions = { ...this.defaultOptions, ...options };

      const svgString = await QRCode.toString(verificationUrl, {
        type: 'svg',
        width: qrOptions.width,
        margin: qrOptions.margin,
        color: qrOptions.color,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel,
      });

      return svgString;
    } catch (error) {
      console.error('QR SVG generation error:', error);
      throw new Error('Failed to generate QR code as SVG');
    }
  }

  /**
   * Generate QR code as buffer (for file download)
   */
  public async generateQRBuffer(
    tokenId: string,
    options: Omit<QRCodeOptions, 'type'> = {}
  ): Promise<Buffer> {
    try {
      const verificationUrl = this.getVerificationUrl(tokenId);
      const qrOptions = {
        ...this.defaultOptions,
        ...options,
        type: 'png' as const, // Buffer generation requires 'png' not 'image/png'
      };

      const buffer = await QRCode.toBuffer(verificationUrl, qrOptions);
      return buffer;
    } catch (error) {
      console.error('QR buffer generation error:', error);
      throw new Error('Failed to generate QR code as buffer');
    }
  }

  /**
   * Generate QR code with custom data (not just verification URL)
   */
  public async generateCustomQR(
    data: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const qrOptions = { ...this.defaultOptions, ...options };
      const qrDataURL = await QRCode.toDataURL(data, qrOptions);
      return qrDataURL;
    } catch (error) {
      console.error('Custom QR generation error:', error);
      throw new Error('Failed to generate custom QR code');
    }
  }

  /**
   * Generate QR code with embedded logo/image
   */
  public async generateQRWithLogo(
    tokenId: string,
    logoPath: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      // This is a simplified version - in a real implementation,
      // you might want to use a library like 'qrcode-with-logos'
      const verificationUrl = this.getVerificationUrl(tokenId);
      const qrOptions = { ...this.defaultOptions, ...options };

      // Generate base QR code
      const qrDataURL = await QRCode.toDataURL(verificationUrl, qrOptions);

      // Note: To actually embed a logo, you would need additional image processing
      // This is just returning the base QR code for now
      return qrDataURL;
    } catch (error) {
      console.error('QR with logo generation error:', error);
      throw new Error('Failed to generate QR code with logo');
    }
  }

  /**
   * Validate QR code data
   */
  public validateQRData(data: string): boolean {
    try {
      // Check if it's a valid URL
      new URL(data);
      return true;
    } catch {
      // If not a URL, check if it's valid data
      return data.length > 0 && data.length <= 4296; // QR code max capacity
    }
  }

  /**
   * Get verification URL for a token ID
   */
  private getVerificationUrl(tokenId: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontendUrl}/verify/${tokenId}`;
  }

  /**
   * Get QR code info without generating the image
   */
  public getQRInfo(tokenId: string): {
    tokenId: string;
    verificationUrl: string;
    estimatedSize: number;
  } {
    const verificationUrl = this.getVerificationUrl(tokenId);
    return {
      tokenId,
      verificationUrl,
      estimatedSize: verificationUrl.length,
    };
  }

  /**
   * Generate QR code with analytics tracking
   */
  public async generateQRWithTracking(
    tokenId: string,
    trackingParams: Record<string, string> = {},
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const baseUrl = this.getVerificationUrl(tokenId);
      const url = new URL(baseUrl);

      // Add tracking parameters
      Object.entries(trackingParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const qrOptions = { ...this.defaultOptions, ...options };
      const qrDataURL = await QRCode.toDataURL(url.toString(), qrOptions);
      return qrDataURL;
    } catch (error) {
      console.error('QR with tracking generation error:', error);
      throw new Error('Failed to generate QR code with tracking');
    }
  }
}

// Export singleton instance
export default new QRService();
