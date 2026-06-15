import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Import inventory routes
import productRouter from './routes/inventory/product.route';
import inventoryItemRouter from './routes/inventory/inventory-item.route';
import stockRouter from './routes/inventory/stock.route';
import fileRouter from './routes/inventory/file.route';

// Import middleware
import { asyncHandler } from './middleware';

/**
 * Create and configure Express application
 */
export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Route registration
  app.use('/api/product', productRouter);
  app.use('/api/inventory', inventoryItemRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/file', fileRouter);

  // Response handling middleware (must be after routes)
  app.use(
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
      // If res.locals.datas exists, return it as JSON response
      if (res.locals.datas) {
        return res.json(res.locals.datas);
      }

      // If no data set, return 404 for unmatched routes
      return res.status(404).json({
        result: 1,
        msg: 'Route not found',
        alg: '',
        datas: null,
      });
    })
  );

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      result: 1,
      msg: err.message || 'Internal server error',
      alg: '',
      datas: null,
    });
  });

  return app;
}

export default createApp;
