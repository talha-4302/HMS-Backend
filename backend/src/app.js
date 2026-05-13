import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hms-backend',
  });
});
