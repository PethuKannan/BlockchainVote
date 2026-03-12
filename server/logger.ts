import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
// @ts-ignore
import { ecsFormat } from '@elastic/ecs-winston-format';
import geoip from 'geoip-lite';

// 1. Custom Middleware to Inject GeoIP Data
const geoIpEnricher = winston.format((info) => {
  if (info.reqIp) {
    // Explicitly cast reqIp as a string to satisfy TypeScript
    const geo = geoip.lookup(info.reqIp as string); 
    if (geo) {
      info.source = {
        ip: info.reqIp,
        geo: {
          location: {
            lat: geo.ll[0],
            lon: geo.ll[1]
          },
          city_name: geo.city,
          country_iso_code: geo.country,
          region_name: geo.region
        }
      };
    }
  }
  return info;
});

// 2. Configure the Elastic Serverless Connection
const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: process.env.ELASTIC_URL as string,
    auth: { apiKey: process.env.ELASTIC_API_KEY as string },
  },
  indexPrefix: 'evoting-telemetry', // Matches your project theme
};

// 3. Create the Main Logger
export const logger = winston.createLogger({
  level: 'info',
  // Combine your GeoIP enricher with the official ECS format
  format: winston.format.combine(
    geoIpEnricher(),
    ecsFormat() 
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

// 4. Attach the Elastic Transport
if (process.env.ELASTIC_URL && process.env.ELASTIC_API_KEY) {
  const esTransport = new ElasticsearchTransport(esTransportOpts);

  esTransport.on('error', (error) => {
    console.error('!! ELASTIC SIEM TRANSPORT ERROR !!', error);
  });

  logger.add(esTransport);
  console.log("✅ Elastic SIEM (Serverless) Logging & Geo-Tracking Enabled");
}