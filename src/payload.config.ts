import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { migrations } from './migrations'
import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Quant Cloud injects DB_* credentials for managed Postgres/RDS; a full
// DATABASE_URI (e.g. bring-your-own RDS or hosted Postgres) takes precedence.
// DATABASE_URL is kept as an alias for compatibility with upstream Payload
// docs and this scaffold's own .env.example.
const databaseUri =
  process.env.DATABASE_URI ||
  process.env.DATABASE_URL ||
  (process.env.DB_HOST
    ? `postgresql://${encodeURIComponent(process.env.DB_USERNAME || '')}:${encodeURIComponent(process.env.DB_PASSWORD || '')}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_DATABASE || ''}`
    : '')

// SMTP via Quant Cloud's QUANT_SMTP_* convention (generic SMTP_* also
// accepted, taking precedence). When neither is set, Payload logs emails to
// the console instead of sending — fine for local dev, but set these in
// production or password resets go nowhere. Port 465 = implicit TLS.
//
// When QUANT_SMTP_RELAY_ENABLED=true the app-node base image runs a local
// Postfix relay on 127.0.0.1:25 (it handles upstream TLS + auth and gives
// queueing/retry); send through it unauthenticated. Otherwise connect to
// the upstream relay directly with credentials.
const smtpRelayEnabled = process.env.QUANT_SMTP_RELAY_ENABLED === 'true'
const smtpHost =
  process.env.SMTP_HOST || (smtpRelayEnabled ? '127.0.0.1' : process.env.QUANT_SMTP_HOST)
const smtpPort = Number(
  process.env.SMTP_PORT || (smtpRelayEnabled ? 25 : process.env.QUANT_SMTP_PORT || 587),
)
const smtpUser =
  process.env.SMTP_USER || (smtpRelayEnabled ? undefined : process.env.QUANT_SMTP_USERNAME)
const smtpPass =
  process.env.SMTP_PASS || (smtpRelayEnabled ? undefined : process.env.QUANT_SMTP_PASSWORD)

export default buildConfig({
  ...(smtpHost
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: process.env.SMTP_FROM || process.env.QUANT_SMTP_FROM || '',
          defaultFromName: process.env.SMTP_FROM_NAME || 'Payload CMS',
          transportOptions: {
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
          },
        }),
      }
    : {}),
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: databaseUri,
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    },
    // Applies committed migrations on production boot; throws (and fails the
    // deploy) if a migration fails. Dev mode still uses schema push.
    prodMigrations: migrations,
  }),
  collections: [Pages, Posts, Media, Categories, Users],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer],
  plugins,
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
