import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

// 1. Configure the connection
const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTIC_URL,
    // Serverless uses API Key, standard uses Username/Password
    auth: process.env.ELASTIC_API_KEY 
      ? { apiKey: process.env.ELASTIC_API_KEY }
      : { 
          username: process.env.ELASTIC_USERNAME || 'elastic',
          password: process.env.ELASTIC_PASSWORD || '',
        },
  },
  indexPrefix: 'vote-app-logs',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
};

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// 2. Enable Elastic only if URL is present
if (process.env.ELASTIC_URL) {
  logger.add(new ElasticsearchTransport(esTransportOpts));
  console.log("✅ Elastic SIEM Logging Enabled");
}