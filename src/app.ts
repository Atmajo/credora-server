import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/database';

// Import routes
import authRoutes from './routes/auth';
import organizationRoutes from './routes/organization';
import credentialRoutes from './routes/credentials';
import fileRoutes from './routes/file';
import blockchainRoutes from './routes/blockchain';
import walletRoutes from './routes/wallet';
import verificationRoutes from './routes/verification';

class App {
  public app: express.Application;
  private port: string | number;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;

    this.initializeDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await connectDB();
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    }
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: (origin, callback) => {
          const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5500',
          ];

          // Allow requests with no origin (mobile apps, etc.)
          if (!origin) return callback(null, true);

          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    // Body parsing middleware
    this.app.use(
      express.json({
        limit: '10mb',
        verify: (req, res, buf) => {
          try {
            JSON.parse(buf.toString());
          } catch (e) {
            throw new Error('Invalid JSON');
          }
        },
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: '10mb',
      })
    );

    // Request logging middleware (development only)
    if (process.env.NODE_ENV === 'development') {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }

    // Health check middleware
    this.app.use('/health', (req: Request, res: Response) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        blockchain: {
          network: process.env.NETWORK_NAME || 'localhost',
          rpcUrl: process.env.RPC_URL ? 'configured' : 'not configured',
        },
      });
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/organization', organizationRoutes);
    this.app.use("/api/credentials", credentialRoutes);
    this.app.use("/api/file", fileRoutes);
    this.app.use('/api/blockchain', blockchainRoutes);
    this.app.use('/api/wallet', walletRoutes);
    this.app.use('/api/verification', verificationRoutes);
    // this.app.use('/api/institutions', institutionRoutes);
    // this.app.use('/api/users', userRoutes);

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'Credential Passport API',
        version: '1.0.0',
        description: 'Blockchain-based credential verification system',
        endpoints: {
          auth: '/api/auth',
          organization: '/api/organization',
          credentials: '/api/credentials',
          blockchain: '/api/blockchain',
          wallet: '/api/wallet',
          verification: '/api/verification',
          file: '/api/file',
          health: '/health',
        },
        documentation: 'https://docs.credora.tech',
      });
    });

    // 404 handler for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Credential Passport API Server',
        version: '1.0.0',
        status: 'Running',
        timestamp: new Date().toISOString(),
        api: '/api',
        health: '/health',
      });
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use(
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        console.error(error);
        
        console.error('Global error:', {
          message: error.message,
          stack:
            process.env.NODE_ENV === 'development' ? error.stack : undefined,
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString(),
        });

        // Handle specific error types
        if (error.message === 'Invalid JSON') {
          return res.status(400).json({
            error: 'Invalid JSON in request body',
          });
        }

        if (error.message === 'Not allowed by CORS') {
          return res.status(403).json({
            error: 'CORS policy violation',
          });
        }

        return res.status(500).json({
          error: 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && {
            details: error.message,
            stack: error.stack,
          }),
        });
      }
    );

    // Catch-all 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
      });
    });
  }

  public listen(): void {
    this.app.listen(this.port, () => {
      console.log('🚀 ==========================================');
      console.log(`🚀 Server running on port ${this.port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(
        `🔗 Blockchain Network: ${process.env.NETWORK_NAME || 'localhost'}`
      );
      console.log(`🌐 API Documentation: http://localhost:${this.port}/api`);
      console.log(`❤️  Health Check: http://localhost:${this.port}/health`);
      console.log('🚀 ==========================================');
    });

    // Graceful shutdown
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  private gracefulShutdown(signal: string): void {
    console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);

    // Close database connections, cleanup resources, etc.
    process.exit(0);
  }
}

// Create and start the application
const application = new App();
application.listen();

export default application.app;
