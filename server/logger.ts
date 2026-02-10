import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

// 1. Configure the connection options
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

// 2. Create the main logger (always logs to Console)
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

// 3. Add Elastic Transport (with Error Handling)
if (process.env.ELASTIC_URL) {
  const esTransport = new ElasticsearchTransport(esTransportOpts);

  // CRITICAL: Listen for errors so we know why it fails!
  esTransport.on('error', (error) => {
    console.error('!! ELASTIC TRANSPORT ERROR !!', error);
  });

  logger.add(esTransport);
  console.log("✅ Elastic SIEM Logging Enabled");
}