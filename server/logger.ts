import winston from 'winston';
import TransportStream from 'winston-transport';
import { ecsFormat } from '@elastic/ecs-winston-format';
import { Client } from '@elastic/elasticsearch';
import geoip from 'geoip-lite';

// 1. GeoIP Enricher
const geoIpEnricher = winston.format((info) => {
  if (info.reqIp) {
    const geo = geoip.lookup(info.reqIp as string);
    if (geo) {
      info.source = {
        ip: info.reqIp,
        geo: {
          location: { lat: geo.ll[0], lon: geo.ll[1] },
          city_name: geo.city,
          country_iso_code: geo.country,
          region_name: geo.region,
        },
      };
    }
  }
  return info;
});

// 2. Create Elastic client (Serverless-compatible)
let esClient: Client | null = null;

if (process.env.ELASTIC_URL && process.env.ELASTIC_API_KEY) {
  esClient = new Client({
    node: process.env.ELASTIC_URL,
    auth: { apiKey: process.env.ELASTIC_API_KEY },
  });

  esClient.info()
    .then(() => console.log('🟢 ELASTIC HANDSHAKE SUCCESS!'))
    .catch((err: any) => {
      console.error('🔴 ELASTIC HANDSHAKE FAILED!', err.message);
    });

  console.log('✅ Elastic SIEM (Serverless) Logging & Geo-Tracking Enabled');
} else {
  console.warn('⚠️  ELASTIC_URL or ELASTIC_API_KEY not set — console only');
}

// 3. Custom Serverless-compatible Winston Transport
class ServerlessElasticTransport extends TransportStream {  // ✅ Fix 1: extend TransportStream not winston.Transport
  private indexPrefix: string;

  constructor(opts?: any) {
    super(opts);
    this.indexPrefix = opts?.indexPrefix || 'evoting-telemetry';
  }

  log(info: any, callback: () => void) {
    setImmediate(() => this.emit('logged', info));         // ✅ Fix 2: emit works now (TransportStream extends EventEmitter)

    if (!esClient) {
      callback();
      return;
    }

    const index = `${this.indexPrefix}-${new Date().toISOString().slice(0, 10)}`;

    esClient.index({
      index,
      document: {
        ...info,
        '@timestamp': new Date().toISOString(),
      },
    }).catch((err: any) => {
      console.error('!! ELASTIC INDEX ERROR !!', err.message);
    });

    callback();
  }
}

// 4. Create the Main Logger
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
    new ServerlessElasticTransport({  // ✅ Fix 3: now satisfies TransportStream type
      level: 'info',
      indexPrefix: 'evoting-telemetry',
    }),
  ],
});