import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { ecsFormat } from '@elastic/ecs-winston-format'; // ✅ Fix 1: removed @ts-expect-error (types exist)
import geoip from 'geoip-lite';

// 1. GeoIP Enricher — adds location data to every log that has reqIp
const geoIpEnricher = winston.format((info) => {
  if (info.reqIp) {
    const geo = geoip.lookup(info.reqIp as string);
    if (geo) {
      info.source = {
        ip: info.reqIp,
        geo: {
          location: {
            lat: geo.ll[0],
            lon: geo.ll[1],
          },
          city_name: geo.city,
          country_iso_code: geo.country,
          region_name: geo.region,
        },
      };
    }
  }
  return info;
});

// 2. Create the Main Logger (console always active)
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    geoIpEnricher(),
    ecsFormat()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ],
});

// 3. Attach Elastic Transport only if credentials are present
if (process.env.ELASTIC_URL && process.env.ELASTIC_API_KEY) {
  const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: {
    node: process.env.ELASTIC_URL,
    auth: { apiKey: process.env.ELASTIC_API_KEY },
    maxRetries: 5,
    requestTimeout: 10000,
    sniffOnStart: false,       // ✅ required for Elastic Cloud
    tls: {
      rejectUnauthorized: false // ✅ fixes bulk writer SSL handshake
    },
  },
  indexPrefix: 'evoting-telemetry',
  ensureIndexTemplate: false,
  flushInterval: 2000,         // ✅ flush every 2s instead of default
  retryLimit: 5,               // ✅ retry failed bulk writes
  buffering: true,             // ✅ buffer logs if connection drops
  bufferLimit: 100,
});

  // Handle transport-level errors gracefully (don't crash the app)
  esTransport.on('error', (error) => {
    console.error('!! ELASTIC SIEM TRANSPORT ERROR !!', error);
  });

  logger.add(esTransport);
  console.log('✅ Elastic SIEM (Serverless) Logging & Geo-Tracking Enabled');

  // Handshake check — confirms Elastic connection on startup
  // @ts-expect-error - client is not typed on ElasticsearchTransport
  esTransport.client.info()
    .then(() => console.log('🟢 ELASTIC HANDSHAKE SUCCESS!'))
    .catch((err: any) => {
      console.error('🔴 ELASTIC HANDSHAKE FAILED! THE REAL REASON IS:');
      console.error(err.message);
      if (err.meta?.body) {
        console.error(JSON.stringify(err.meta.body, null, 2));
      }
    });
} else {
  console.warn('⚠️  ELASTIC_URL or ELASTIC_API_KEY not set — logging to console only');
}