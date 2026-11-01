import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { eq, or, and } from 'drizzle-orm';

// Idempotent webhook event deduplication tracking
const processedWebhookEvents = new Set<string>();
import { db } from './src/db/index.ts';
import {
  states,
  cities,
  profiles,
  shops,
  barbers,
  services,
  reviews,
  favorites,
  notifications,
  workingHours,
  payments,
  coupons,
  reports,
  appointments,
  platformSettings,
  barberPayouts,
  financialLedger,
  webhookEvents,
} from './src/db/schema.ts';
import {
  getOrCreateUser,
  getBootstrapState,
  createBookingInDb,
  updateAppointmentInDb,
  resolveAllowedRole,
  getPlatformSettings,
  updatePlatformSettingsInDb,
  calculateServerBookingPrice,
  verifyAndCompleteAppointmentInDb,
  regenerateCustomerCompletionOtp,
  toggleAdminPayoutHold,
  processAppointmentRefund,
} from './src/db/users.ts';
import { decryptCompletionOtp } from './src/lib/payoutOtp.ts';
import {
  executeBarberPayoutTransfer,
  confirmBarberPayoutSettlement,
  postLedgerTransaction,
} from './src/lib/ledgerEngine.ts';
import {
  requireAuth,
  requireBarberOrAdmin,
  requireAdmin,
  optionalAuth,
  AuthRequest,
} from './src/middleware/auth.ts';
import { ASSETS } from './src/data/barberlooData.ts';

function validateCoordinates(lat?: any, lng?: any): { valid: boolean; lat?: string; lng?: string; error?: string } {
  if (lat === undefined && lng === undefined) return { valid: true };
  if (!lat && !lng) return { valid: true, lat: '', lng: '' };
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return { valid: false, error: 'Latitude and Longitude must be valid numbers.' };
  }
  if (numLat < -90 || numLat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90 degrees.' };
  }
  if (numLng < -180 || numLng > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180 degrees.' };
  }
  return { valid: true, lat: numLat.toFixed(6), lng: numLng.toFixed(6) };
}

// In-memory geocode cache to avoid repeated external requests
const geocodeCache = new Map<string, any[]>();

const KNOWN_INDIAN_LOCATIONS: Record<string, { lat: number; lng: number; displayName: string }> = {
  'ludhiana': { lat: 30.9010, lng: 75.8573, displayName: 'Ludhiana, Punjab, India' },
  'maha luxmi nagar': { lat: 30.8987, lng: 75.8645, displayName: 'Maha Luxmi Nagar, Ludhiana, Punjab' },
  'model town ludhiana': { lat: 30.8872, lng: 75.8344, displayName: 'Model Town, Ludhiana, Punjab' },
  'sarabha nagar': { lat: 30.8824, lng: 75.8115, displayName: 'Sarabha Nagar, Ludhiana, Punjab' },
  'civil lines ludhiana': { lat: 30.9124, lng: 75.8398, displayName: 'Civil Lines, Ludhiana, Punjab' },
  'jalandhar': { lat: 31.3260, lng: 75.5762, displayName: 'Jalandhar, Punjab, India' },
  'model town jalandhar': { lat: 31.3130, lng: 75.5866, displayName: 'Model Town, Jalandhar, Punjab' },
  'amritsar': { lat: 31.6340, lng: 74.8723, displayName: 'Amritsar, Punjab, India' },
  'chandigarh': { lat: 30.7333, lng: 76.7794, displayName: 'Chandigarh, India' },
  'sector 17 chandigarh': { lat: 30.7415, lng: 76.7790, displayName: 'Sector 17, Chandigarh' },
  'delhi': { lat: 28.6139, lng: 77.2090, displayName: 'New Delhi, Delhi NCR, India' },
  'connaught place': { lat: 28.6315, lng: 77.2167, displayName: 'Connaught Place, New Delhi' },
  'gurugram': { lat: 28.4595, lng: 77.0266, displayName: 'Gurugram, Haryana, India' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, displayName: 'Bengaluru, Karnataka, India' },
  'mumbai': { lat: 19.0760, lng: 72.8777, displayName: 'Mumbai, Maharashtra, India' },
  'patiala': { lat: 30.3398, lng: 76.3869, displayName: 'Patiala, Punjab, India' },
  'bathinda': { lat: 30.2110, lng: 74.9455, displayName: 'Bathinda, Punjab, India' },
  'mohali': { lat: 30.7046, lng: 76.7179, displayName: 'Mohali, Punjab, India' },
  '141001': { lat: 30.9010, lng: 75.8573, displayName: 'PIN 141001 - Ludhiana Central, Punjab' },
  '141008': { lat: 30.8987, lng: 75.8645, displayName: 'PIN 141008 - Maha Luxmi Nagar / Shivpuri, Ludhiana, Punjab' },
  '144001': { lat: 31.3260, lng: 75.5762, displayName: 'PIN 144001 - Jalandhar City, Punjab' },
  '144003': { lat: 31.3130, lng: 75.5866, displayName: 'PIN 144003 - Model Town, Jalandhar, Punjab' },
  '160017': { lat: 30.7415, lng: 76.7790, displayName: 'PIN 160017 - Sector 17, Chandigarh' },
  '110001': { lat: 28.6315, lng: 77.2167, displayName: 'PIN 110001 - Connaught Place, New Delhi' },
};

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('error', (err) => {
    console.warn('[WebSocket Warning] Server error ignored:', err?.message);
  });

  // CORS: Allow verified domains
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (
      origin.includes('barberloo.in') ||
      origin.includes('github.com') ||
      origin.includes('run.app') ||
      origin.includes('localhost')
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-WPPusher-Token'
    );
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Support JSON payloads with raw body capture for cryptographic webhook verification
  app.use(
    express.json({
      limit: '50mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Gracefully handle PayloadTooLargeError (HTTP 413) or malformed body
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        error: 'PayloadTooLargeError',
        message: 'Request entity too large. The payload exceeds the allowable size limit (50MB).',
      });
    }
    next(err);
  });

  // Health Check Endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'barberloo',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // WP Pusher & GitHub status & webhook endpoints
  app.get('/api/wppusher/status', async (_req, res) => {
    let githubHasThemeFiles = false;
    try {
      const ghRes = await fetch(
        'https://api.github.com/repos/nexwaveservices-web/BarberLooV1/contents/style.css?ref=main',
        { headers: { 'User-Agent': 'BarberLoo-Server' } }
      );
      githubHasThemeFiles = ghRes.status === 200;
    } catch {
      githubHasThemeFiles = false;
    }

    res.json({
      connected: true,
      githubHasThemeFiles,
      domain: 'https://barberloo.in',
      githubRepository: 'https://github.com/nexwaveservices-web/BarberLooV1',
      githubSlug: 'nexwaveservices-web/BarberLooV1',
      branch: 'main',
      pluginFile: 'barberloo.php',
      themeStylesheet: 'style.css',
      supabaseUrl: 'https://ddusvfylhifoniobzmcq.supabase.co',
      pushToDeployReady: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Push WordPress Theme & Plugin files directly to GitHub repo (Admin Only)
  app.post('/api/wppusher/push-to-github', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const token = String(req.body?.githubToken || '').trim();
      const repo = String(
        req.body?.repository || 'nexwaveservices-web/BarberLooV1'
      ).trim();
      const branch = String(req.body?.branch || 'main').trim();

      if (!token) {
        return res.status(400).json({
          error:
            'Please enter a GitHub Personal Access Token (with repo permission).',
        });
      }

      const filesToPush = [
        'style.css',
        'index.php',
        'functions.php',
        'header.php',
        'footer.php',
        'barberloo.php',
        '.htaccess',
        'public/sw.js',
        'public/CNAME',
        'wp-assets/assets/barberloo.css',
        'wp-assets/assets/barberloo.js',
      ];

      const pushedFiles: string[] = [];
      for (const relPath of filesToPush) {
        const absPath = path.join(process.cwd(), relPath);
        if (!fs.existsSync(absPath)) continue;
        const contentBase64 = fs.readFileSync(absPath).toString('base64');

        let existingSha: string | undefined;
        const checkRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${relPath}?ref=${branch}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'User-Agent': 'BarberLoo-WP-Pusher-Sync',
            },
          }
        );
        if (checkRes.status === 200) {
          const existingJson: any = await checkRes.json();
          existingSha = existingJson?.sha;
        }

        const putRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${relPath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'User-Agent': 'BarberLoo-WP-Pusher-Sync',
            },
            body: JSON.stringify({
              message: `chore(wppusher): update ${relPath} for BarberLoo WordPress theme`,
              content: contentBase64,
              branch,
              ...(existingSha ? { sha: existingSha } : {}),
            }),
          }
        );

        if (!putRes.ok) {
          const errText = await putRes.text();
          return res.status(putRes.status).json({
            error: `GitHub API error pushing ${relPath}: ${errText}`,
          });
        }
        pushedFiles.push(relPath);
      }

      res.json({
        ok: true,
        pushedFiles,
        message: `✓ Successfully pushed ${pushedFiles.length} WordPress Theme & Plugin files (${pushedFiles.join(', ')}) to ${repo} (${branch})!`,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to push theme files to GitHub',
      });
    }
  });

  app.post('/api/wppusher/webhook', (req, res) => {
    broadcastEvent('wppusher:deployed', {
      repository: 'nexwaveservices-web/BarberLooV1',
      domain: 'https://barberloo.in',
      payload: req.body || {},
      timestamp: Date.now(),
    });
    res.json({
      ok: true,
      message: 'WP Pusher deployment webhook received for barberloo.in',
      repository: 'nexwaveservices-web/BarberLooV1',
    });
  });

  const broadcastEvent = (type: string, payload: unknown = {}) => {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
      })
    );
  });

  // 1. Bootstrap State (Role-scoped data filtering, Section 10 No-IDOR)
  app.get('/api/bootstrap', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const activeUid =
        req.user?.uid ||
        (typeof req.query.uid === 'string' ? req.query.uid.trim() : '');
      let userRole: string | undefined = req.user?.role || undefined;

      if (req.user?.uid && req.user?.email) {
        await getOrCreateUser(
          req.user.uid,
          req.user.email,
          req.user.name || req.user.email.split('@')[0]
        );
      }

      // If userRole is not present from JWT, resolve authoritatively from database profile or barber roster
      if (!userRole && activeUid) {
        const [prof] = await db
          .select({ role: profiles.role })
          .from(profiles)
          .where(eq(profiles.uid, activeUid))
          .limit(1);
        if (prof?.role) {
          userRole = prof.role;
        } else {
          // Check if activeUid is an assigned barber or shop owner
          const [barberMatch] = await db
            .select({ id: barbers.id })
            .from(barbers)
            .where(or(eq(barbers.id, activeUid), eq(barbers.userUid, activeUid)))
            .limit(1);
          if (barberMatch) {
            userRole = 'barber';
          }
        }
      }

      const data = await getBootstrapState(activeUid || undefined, userRole);
      res.json(data);
    } catch (error: any) {
      console.error('GET /api/bootstrap error:', error);
      res
        .status(500)
        .json({ error: error.message || 'Failed to load platform data' });
    }
  });

  // 1b. Location Hierarchy Endpoints (States & Cities)
  app.get('/api/locations/states', async (_req, res) => {
    try {
      const allStates = await db.select().from(states).orderBy(states.name);
      res.json(allStates);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch states' });
    }
  });

  app.get('/api/locations/cities', async (req, res) => {
    try {
      const stateId = req.query.state_id as string | undefined;
      const allCities = stateId
        ? await db.select().from(cities).where(eq(cities.stateId, stateId)).orderBy(cities.name)
        : await db.select().from(cities).orderBy(cities.name);
      res.json(allCities);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch cities' });
    }
  });

  // 1c. Safe Geocoding Proxy with Memory Cache & Offline Fallbacks
  app.get('/api/geocode/search', async (req, res) => {
    const rawQuery = String(req.query.q || '').trim();
    if (!rawQuery || rawQuery.length < 2) {
      return res.json([]);
    }

    const normQuery = rawQuery.toLowerCase();
    if (geocodeCache.has(normQuery)) {
      return res.json(geocodeCache.get(normQuery));
    }

    // Check direct known dictionary matches first
    const directMatches: any[] = [];
    for (const [key, loc] of Object.entries(KNOWN_INDIAN_LOCATIONS)) {
      if (normQuery === key || key.includes(normQuery) || normQuery.includes(key)) {
        directMatches.push({
          displayName: loc.displayName,
          lat: loc.lat,
          lng: loc.lng,
          source: 'barberloo_index',
        });
      }
    }

    if (directMatches.length > 0) {
      geocodeCache.set(normQuery, directMatches);
      return res.json(directMatches);
    }

    // Query OpenStreetMap Nominatim with safe timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&limit=5&q=${encodeURIComponent(
        rawQuery
      )}`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'BarberLoo-Navigation/1.0 (info@barberloo.in)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const results = data.map((item: any) => ({
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            city: item.address?.city || item.address?.town || item.address?.village || item.address?.suburb || '',
            state: item.address?.state || '',
            pinCode: item.address?.postcode || '',
            source: 'osm_nominatim',
          }));

          geocodeCache.set(normQuery, results);
          return res.json(results);
        }
      }
    } catch {
      // Offline or rate-limited: Fallback to best known matches or cities in database
    }

    // Fallback: search in database cities
    try {
      const allDbCities = await db.select().from(cities);
      const matchedDbCity = allDbCities.find((c) =>
        c.name.toLowerCase().includes(normQuery) || normQuery.includes(c.name.toLowerCase())
      );
      if (matchedDbCity) {
        const cityKey = matchedDbCity.name.toLowerCase();
        const known = KNOWN_INDIAN_LOCATIONS[cityKey];
        if (known) {
          const fallback = [{
            displayName: `${matchedDbCity.name}, India`,
            lat: known.lat,
            lng: known.lng,
            city: matchedDbCity.name,
            source: 'db_fallback',
          }];
          geocodeCache.set(normQuery, fallback);
          return res.json(fallback);
        }
      }
    } catch {
      // Ignore db error
    }

    // Return empty results gracefully
    geocodeCache.set(normQuery, []);
    res.json([]);
  });

  // 2. Auth & Profile Synchronization (Requires Verified Session)
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || req.body.email;
      if (!email) {
        return res.status(400).json({ error: 'Valid email required' });
      }

      const name = req.body.name || req.user?.name || email.split('@')[0];
      const requestedRole = req.body.role;
      const phone = req.body.phone;
      const stateId = req.body.stateId || req.body.state_id;
      const cityId = req.body.cityId || req.body.city_id;
      const stateName = req.body.state;
      const cityName = req.body.city;

      await getOrCreateUser(uid, email, name, requestedRole, phone, stateId, cityId, stateName, cityName);

      const profs = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, uid));
      res.json({ profile: profs[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // 3a. Get Current Authenticated Session & Profile (/api/auth/me)
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, req.user!.uid))
        .limit(1);

      res.json({
        user: req.user,
        profile: prof || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to verify session' });
    }
  });

  // 3b. Get User Profile (Ownership or Admin Authorization Required)
  app.get('/api/profiles/:uid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      const requester = req.user!;

      if (requester.uid !== uid && requester.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to view another user profile.',
        });
      }

      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, uid))
        .limit(1);

      if (!prof) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json(prof);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch profile' });
    }
  });

  // 3c. Update Profile / User Management (Ownership or Admin Authorization Required)
  app.patch('/api/profiles/:uid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.params;
      const requester = req.user!;

      // Ownership enforcement: regular users can only edit their own profile
      if (requester.uid !== uid && requester.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to modify another user profile.',
        });
      }

      const existing = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, uid))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      const {
        name,
        phone,
        preferredNotes,
        role,
        status,
        avatarUrl,
        stateId,
        cityId,
        state: stateName,
        city: cityName,
      } = req.body;

      const updateFields: Record<string, unknown> = {};
      if (name !== undefined) updateFields.name = String(name).trim();
      if (phone !== undefined) updateFields.phone = String(phone).trim();
      if (preferredNotes !== undefined) updateFields.preferredNotes = preferredNotes;
      if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;
      if (stateId !== undefined) updateFields.stateId = stateId;
      if (cityId !== undefined) updateFields.cityId = cityId;
      if (stateName !== undefined) updateFields.state = stateName;
      if (cityName !== undefined) updateFields.city = cityName;

      // Only admins can alter account status or role
      if (requester.role === 'admin') {
        if (role !== undefined) {
          updateFields.role = resolveAllowedRole(role, existing[0]?.role);
        }
        if (status !== undefined) {
          updateFields.status = status;
          if (status === 'suspended') {
            await db
              .update(barbers)
              .set({ active: false, verificationStatus: 'suspended' })
              .where(or(eq(barbers.userUid, uid), eq(barbers.id, uid)))
              .catch(() => {});
          } else if (status === 'active') {
            await db
              .update(barbers)
              .set({ active: true, verificationStatus: 'verified', verified: true })
              .where(or(eq(barbers.userUid, uid), eq(barbers.id, uid)))
              .catch(() => {});
          }
        }
      }

      const [updated] = await db
        .update(profiles)
        .set(updateFields)
        .where(eq(profiles.uid, uid))
        .returning();

      broadcastEvent('state:updated', { entity: 'profiles' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update profile' });
    }
  });

  // 4. Create Appointment (Authentication Required - Only customers/admins can book)
  app.post('/api/appointments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const requester = req.user!;
      const aptId = req.body.id || `apt-${Date.now()}`;
      const customerUid = requester.uid;

      // Retrieve customer profile for verified details
      let userProf: any = null;
      const [prof] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, requester.uid))
        .limit(1);
      userProf = prof;

      // Barbers and shop owners cannot create bookings
      if (requester?.role === 'barber' || userProf?.role === 'barber') {
        return res.status(403).json({
          error: 'Forbidden: Barber accounts cannot create bookings.',
        });
      }

      const clientName =
        (req.body.clientName && String(req.body.clientName).trim()) ||
        userProf?.name ||
        requester?.name ||
        'Valued Client';
      const clientPhone =
        (req.body.clientPhone && String(req.body.clientPhone).trim()) ||
        userProf?.phone ||
        '+91';

      const created = await createBookingInDb({
        id: aptId,
        customerUid,
        clientName,
        clientPhone,
        shopId: req.body.shopId || 'shop-1',
        shopName: req.body.shopName || '',
        barberId: req.body.barberId,
        barberName: req.body.barberName || '',
        serviceId: req.body.serviceId,
        serviceName: req.body.serviceName || '',
        date: req.body.date,
        time: req.body.time,
        durationMin: Number(req.body.durationMin) || 45,
        price: Number(req.body.price) || 0,
        paymentMethod: req.body.paymentMethod || 'online',
        razorpayPaymentId: req.body.razorpayPaymentId || '',
        razorpayOrderId: req.body.razorpayOrderId || '',
        woocommerceOrderId: req.body.woocommerceOrderId || '',
        notes: req.body.notes || '',
        couponCode: req.body.couponCode || '',
        addOns: req.body.addOns || [],
        addOnsTotal: Number(req.body.addOnsTotal) || 0,
      });

      broadcastEvent('state:updated', {
        entity: 'appointments',
        appointment: created,
      });
      res.json(created);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || 'Failed to create appointment' });
    }
  });

  // 5. Update Appointment Status / Reschedule / Cancel / Notes (Auth Required)
  app.patch(
    '/api/appointments/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const updated = await updateAppointmentInDb(
          req.params.id,
          req.body,
          req.user
        );
        broadcastEvent('state:updated', {
          entity: 'appointments',
          appointment: updated,
        });
        res.json(updated);
      } catch (error: any) {
        res
          .status(400)
          .json({ error: error.message || 'Failed to update appointment' });
      }
    }
  );

  // 5b. Customer Completion OTP Retrieval (Authenticated Customer Only)
  app.get(
    '/api/appointments/:id/completion-otp',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const [apt] = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, req.params.id));

        if (!apt) {
          return res.status(404).json({ error: 'Appointment not found.' });
        }

        // Strictly verify customer identity (Barbers and Admins are NOT allowed to view customer OTP secret)
        const isCustomer = apt.customerUid === req.user!.uid;

        if (!isCustomer) {
          return res.status(403).json({
            error: 'Forbidden: Completion OTP secrets are strictly confidential to the customer only.',
          });
        }

        if (apt.status === 'completed') {
          return res.json({
            appointmentId: apt.id,
            status: 'consumed',
            message: 'Appointment is already completed and OTP verified.',
          });
        }

        if (apt.status === 'cancelled') {
          return res.status(400).json({
            error: 'Cannot retrieve OTP for a cancelled appointment.',
          });
        }

        const rawOtp = apt.completionOtpCipher
          ? decryptCompletionOtp(apt.completionOtpCipher)
          : null;

        res.json({
          appointmentId: apt.id,
          completionOtp: rawOtp,
          status: apt.completionOtpStatus || 'active',
          expiresAt: apt.completionOtpExpiresAt,
          attempts: apt.completionOtpAttempts || 0,
          maxAttempts: apt.completionOtpMaxAttempts || 5,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to retrieve OTP' });
      }
    }
  );

  // 5c. Customer Completion OTP Regeneration (Authenticated Customer Only)
  app.post(
    '/api/appointments/:id/regenerate-completion-otp',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const result = await regenerateCustomerCompletionOtp(
          req.params.id,
          req.user!.uid
        );
        broadcastEvent('state:updated', {
          entity: 'appointments',
          appointmentId: req.params.id,
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to regenerate OTP' });
      }
    }
  );

  // 5d. Barber Completion Verification (Authorized Barber / Admin Only)
  app.post(
    '/api/appointments/:id/verify-completion-otp',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const otp = String(req.body.otp || '').trim();
        if (!otp) {
          return res.status(400).json({ error: 'Please enter the 6-digit completion OTP supplied by the customer.' });
        }

        const result = await verifyAndCompleteAppointmentInDb(
          req.params.id,
          otp,
          req.user!
        );

        broadcastEvent('state:updated', {
          entity: 'appointments',
          appointment: result.appointment,
        });
        broadcastEvent('state:updated', {
          entity: 'payouts',
          payout: result.payout,
        });

        res.json({
          success: true,
          message: 'OTP verified successfully. Appointment completed and barber payout initiated.',
          appointment: result.appointment,
          payout: result.payout,
          transferId: result.transferId,
        });
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'OTP verification failed' });
      }
    }
  );

  // 5e. Admin Payout Hold / Release
  app.post(
    '/api/payouts/:id/hold',
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const hold = Boolean(req.body.hold);
        const reason = String(req.body.reason || '').trim();
        const appointmentId = req.params.id.replace(/^payout-/, '');

        const result = await toggleAdminPayoutHold(
          appointmentId,
          req.user!,
          hold,
          reason
        );

        broadcastEvent('state:updated', {
          entity: 'payouts',
          appointmentId,
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to update payout hold' });
      }
    }
  );

  // 5f. Retry Failed Payout
  app.post(
    '/api/payouts/:id/retry',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const payoutId = req.params.id.startsWith('payout-') ? req.params.id : `payout-${req.params.id}`;
        const result = await executeBarberPayoutTransfer(db, payoutId, {
          forcedRetry: true,
        });
        broadcastEvent('state:updated', {
          entity: 'payouts',
          payout: result.payout,
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to retry payout' });
      }
    }
  );

  // 5g. Confirm Payout Bank Settlement
  app.post(
    '/api/payouts/:id/settle',
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const payoutId = req.params.id.startsWith('payout-') ? req.params.id : `payout-${req.params.id}`;
        const result = await confirmBarberPayoutSettlement(
          db,
          payoutId,
          req.body.settlementRef
        );
        broadcastEvent('state:updated', {
          entity: 'payouts',
          payout: result.payout,
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to settle payout' });
      }
    }
  );

  // 5h. Admin Appointment Refund & Reversal
  app.post(
    '/api/appointments/:id/refund',
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const reason = String(req.body.reason || 'Customer refund authorized').trim();
        const result = await processAppointmentRefund(
          req.params.id,
          req.user!,
          reason
        );
        broadcastEvent('state:updated', {
          entity: 'appointments',
          appointment: result.appointment,
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Failed to process refund' });
      }
    }
  );

  // 5i. Admin Financial Overview (Balances, Escrow, and Reconciliation)
  app.get(
    '/api/admin/financial-overview',
    requireAdmin,
    async (_req: AuthRequest, res) => {
      try {
        const allLedger = await db.select().from(financialLedger);
        let totalDebits = 0;
        let totalCredits = 0;

        let customerEscrow = 0;
        let platformFeeRevenue = 0;
        let pendingPayables = 0;
        let payoutsInTransit = 0;
        let settledPayouts = 0;
        let refundsPaid = 0;

        for (const entry of allLedger) {
          const amt = entry.amount;
          if (entry.entryType === 'DEBIT') totalDebits += amt;
          if (entry.entryType === 'CREDIT') totalCredits += amt;

          if (entry.account === 'customer_funds_escrow') {
            customerEscrow += entry.entryType === 'DEBIT' ? amt : -amt;
          } else if (entry.account === 'platform_fee_revenue') {
            platformFeeRevenue += entry.entryType === 'CREDIT' ? amt : -amt;
          } else if (entry.account === 'barber_payable_pending') {
            pendingPayables += entry.entryType === 'CREDIT' ? amt : -amt;
          } else if (entry.account === 'barber_payout_in_transit') {
            payoutsInTransit += entry.entryType === 'CREDIT' ? amt : -amt;
          } else if (entry.account === 'barber_payout_settled') {
            settledPayouts += entry.entryType === 'CREDIT' ? amt : 0;
          } else if (entry.account === 'refunds_payable') {
            refundsPaid += amt;
          }
        }

        const allPayouts = await db.select().from(barberPayouts);

        res.json({
          isBalanced: totalDebits === totalCredits,
          totalDebits,
          totalCredits,
          totalLedgerEntries: allLedger.length,
          accounts: {
            customerEscrow: Math.max(0, customerEscrow),
            platformFeeRevenue: Math.max(0, platformFeeRevenue),
            pendingPayables: Math.max(0, pendingPayables),
            payoutsInTransit: Math.max(0, payoutsInTransit),
            settledPayouts: Math.max(0, settledPayouts),
            refundsPaid,
          },
          payoutCounts: {
            total: allPayouts.length,
            pendingVerification: allPayouts.filter((p) => p.status === 'pending_verification').length,
            initiated: allPayouts.filter((p) => p.status === 'initiated').length,
            settled: allPayouts.filter((p) => p.status === 'settled').length,
            onHold: allPayouts.filter((p) => p.status === 'on_hold').length,
            failed: allPayouts.filter((p) => p.status === 'failed').length,
            reversed: allPayouts.filter((p) => p.status === 'reversed').length,
          },
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to load financial overview' });
      }
    }
  );

  // 5j. Admin Financial Ledger View
  app.get(
    '/api/admin/financial-ledger',
    requireAdmin,
    async (_req: AuthRequest, res) => {
      try {
        const entries = await db
          .select()
          .from(financialLedger)
          .orderBy(financialLedger.entryNumber);

        res.json({
          count: entries.length,
          entries,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to fetch financial ledger' });
      }
    }
  );

  // 5k. Admin Payouts List
  app.get(
    '/api/admin/payouts',
    requireAdmin,
    async (_req: AuthRequest, res) => {
      try {
        const payoutsList = await db
          .select()
          .from(barberPayouts)
          .orderBy(barberPayouts.createdAt);

        res.json(payoutsList);
      } catch (err: any) {
        res.status(500).json({ error: err.message || 'Failed to fetch payouts' });
      }
    }
  );

  // 5l. Razorpay Webhook Endpoint (Cryptographically Verified & Idempotent)
  app.post('/api/webhooks/razorpay', async (req: any, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const signature = (req.headers['x-razorpay-signature'] as string) || '';

      // Verify webhook HMAC-SHA256 signature against raw request body
      if (webhookSecret && webhookSecret.trim() && !webhookSecret.includes('YOUR_RAZORPAY_WEBHOOK_SECRET')) {
        if (!signature || !req.rawBody) {
          return res.status(400).json({ error: 'Missing webhook signature or raw body' });
        }
        const crypto = await import('crypto');
        const expectedSig = crypto
          .createHmac('sha256', webhookSecret.trim())
          .update(req.rawBody)
          .digest('hex');

        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return res.status(400).json({ error: 'Invalid Razorpay webhook signature' });
        }
      } else if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({
          error: 'Fatal: RAZORPAY_WEBHOOK_SECRET is not configured on the production server.',
        });
      }

      // Safe duplicate event handling / replay protection
      const eventId =
        req.body?.event_id ||
        (req.headers['x-razorpay-event-id'] as string) ||
        (req.body?.payload?.payment?.entity?.id ? `${req.body.event}_${req.body.payload.payment.entity.id}` : null) ||
        (req.body?.payload?.transfer?.entity?.id ? `${req.body.event}_${req.body.payload.transfer.entity.id}` : null);

      if (eventId) {
        if (processedWebhookEvents.has(eventId)) {
          return res.json({ status: 'ok', received: true, note: 'Duplicate event already processed' });
        }
        processedWebhookEvents.add(eventId);
        if (processedWebhookEvents.size > 5000) {
          const first = processedWebhookEvents.values().next().value;
          if (first) processedWebhookEvents.delete(first);
        }

        // Database-backed idempotency check
        const [existingDbEvent] = await db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.id, eventId))
          .catch(() => []);

        if (existingDbEvent) {
          return res.json({ status: 'ok', received: true, note: 'Duplicate event already processed' });
        }
      }

      const event = req.body?.event;
      const payload = req.body?.payload;

      if (!event || !payload) {
        return res.status(400).json({ error: 'Invalid webhook payload structure' });
      }

      // 1. Payment Captured Event (Confirm booking & mark payment paid)
      if (event === 'payment.captured' && payload.payment?.entity) {
        const paymentEntity = payload.payment.entity;
        const rzpPaymentId = paymentEntity.id;
        const rzpOrderId = paymentEntity.order_id;

        if (rzpOrderId) {
          await db
            .update(appointments)
            .set({
              paymentStatus: 'paid',
              status: 'confirmed',
              razorpayPaymentId: rzpPaymentId,
            })
            .where(eq(appointments.razorpayOrderId, rzpOrderId))
            .catch(() => {});

          await db
            .update(payments)
            .set({
              status: 'paid',
              providerPaymentId: rzpPaymentId,
              updatedAt: new Date(),
            })
            .where(eq(payments.providerOrderId, rzpOrderId))
            .catch(() => {});
        }
      }

      // 2. Payment Failed Event (Mark payment failed)
      if (event === 'payment.failed' && payload.payment?.entity) {
        const paymentEntity = payload.payment.entity;
        const rzpOrderId = paymentEntity.order_id;
        if (rzpOrderId) {
          await db
            .update(payments)
            .set({
              status: 'failed',
              updatedAt: new Date(),
            })
            .where(eq(payments.providerOrderId, rzpOrderId))
            .catch(() => {});
        }
      }

      // 3. Refund Processed Event
      if (event === 'refund.processed' && payload.refund?.entity) {
        const refundEntity = payload.refund.entity;
        const rzpPaymentId = refundEntity.payment_id;
        if (rzpPaymentId) {
          await db
            .update(payments)
            .set({
              status: 'refunded',
              updatedAt: new Date(),
            })
            .where(eq(payments.providerPaymentId, rzpPaymentId))
            .catch(() => {});
        }
      }

      // 4. Handle payout / transfer settlement event
      if (event === 'payout.processed' || event === 'transfer.processed') {
        const transferId = payload.transfer?.entity?.id || payload.payout?.entity?.id;
        if (transferId) {
          const [payout] = await db
            .select()
            .from(barberPayouts)
            .where(eq(barberPayouts.providerTransferId, transferId));

          if (payout && payout.status !== 'settled') {
            await confirmBarberPayoutSettlement(db, payout.id, transferId);
          }
        }
      }

      // Persist event in webhook_events audit log
      if (eventId) {
        await db
          .insert(webhookEvents)
          .values({
            id: eventId,
            event,
            provider: 'razorpay',
            entityId: (payload.payment?.entity?.id || payload.transfer?.entity?.id || payload.refund?.entity?.id || '') as string,
            payloadJson: JSON.stringify(payload),
            status: 'processed',
          })
          .catch(() => {});
      }

      res.json({ status: 'ok', received: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Webhook processing error' });
    }
  });

  // 6. Services CRUD (Barber / Shop Owner / Admin with Ownership Enforcement)
  app.post('/api/services', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const shopId = req.body.shopId || 'shop-1';
      const [shopRecord] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (!shopRecord) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      if (
        req.user!.role !== 'admin' &&
        req.user!.role !== 'barber' &&
        req.user!.role !== 'shop_owner' &&
        shopRecord.ownerUid !== req.user!.uid
      ) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to add services to this shop.',
        });
      }

      const allSrv = await db.select().from(services);
      const nextIdx = String(allSrv.length + 1).padStart(2, '0');
      const [created] = await db
        .insert(services)
        .values({
          id: `srv-${Date.now()}`,
          shopId,
          indexCode: nextIdx,
          name: req.body.name,
          category: req.body.category || 'Hair',
          durationMin: Number(req.body.durationMin) || 45,
          price: Number(req.body.price) || 850,
          description:
            req.body.description ||
            'Bespoke grooming service tailored by master barbers.',
          popular: Boolean(req.body.popular),
          active: true,
          image: req.body.image || ASSETS.heroCraft,
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'services' });
      res.json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to create service' });
    }
  });

  app.patch('/api/services/:id', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const [srv] = await db
        .select()
        .from(services)
        .where(eq(services.id, req.params.id))
        .limit(1);

      if (!srv) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const [srvShop] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, srv.shopId))
        .limit(1);

      if (
        req.user!.role !== 'admin' &&
        req.user!.role !== 'barber' &&
        req.user!.role !== 'shop_owner' &&
        srvShop?.ownerUid !== req.user!.uid
      ) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to modify services for this shop.',
        });
      }

      const updateData: Record<string, unknown> = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.description !== undefined)
        updateData.description = req.body.description;
      if (req.body.price !== undefined)
        updateData.price = Number(req.body.price);
      if (req.body.durationMin !== undefined)
        updateData.durationMin = Number(req.body.durationMin);
      if (req.body.active !== undefined)
        updateData.active = Boolean(req.body.active);
      if (req.body.category !== undefined)
        updateData.category = req.body.category;

      const [updated] = await db
        .update(services)
        .set(updateData)
        .where(eq(services.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'services' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update service' });
    }
  });

  app.delete(
    '/api/services/:id',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const [srv] = await db
          .select()
          .from(services)
          .where(eq(services.id, req.params.id))
          .limit(1);

        if (!srv) {
          return res.status(404).json({ error: 'Service not found' });
        }

        const [srvShop] = await db
          .select()
          .from(shops)
          .where(eq(shops.id, srv.shopId))
          .limit(1);

        if (
          req.user!.role !== 'admin' &&
          req.user!.role !== 'barber' &&
          req.user!.role !== 'shop_owner' &&
          srvShop?.ownerUid !== req.user!.uid
        ) {
          return res.status(403).json({
            error: 'Forbidden: You do not have permission to delete services for this shop.',
          });
        }

        await db.delete(services).where(eq(services.id, req.params.id));
        broadcastEvent('state:updated', { entity: 'services' });
        res.json({ ok: true });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to delete service' });
      }
    }
  );

  // 7. Barbers Team & Profile CRUD (Ownership Enforced)
  app.post('/api/barbers', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const shopId = req.body.shopId || 'shop-1';
      const [shopRecord] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (!shopRecord) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      if (req.user!.role !== 'admin' && shopRecord.ownerUid !== req.user!.uid) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to add barbers to another shop.',
        });
      }

      const [created] = await db
        .insert(barbers)
        .values({
          id: `brb-${Date.now()}`,
          userUid: req.body.userUid || '',
          shopId,
          shopName: shopRecord.name || req.body.shopName || 'The Royal Barber',
          name: req.body.name,
          role: req.body.role || 'Senior Master Barber',
          rating: '5.0',
          reviewCount: 0,
          experienceYears: Number(req.body.experienceYears) || 5,
          specialty: req.body.specialty || 'Master Haircut · Beard Sculpting',
          nextAvailable: 'Available Today',
          priceFrom: Number(req.body.priceFrom) || 500,
          image: req.body.image || ASSETS.barberMarcus,
          bio:
            req.body.bio ||
            'Bespoke grooming specialist certified in premium styling and hot towel treatments.',
          featured: true,
          active: true,
          verified: req.user!.role === 'admin',
          verificationStatus: req.user!.role === 'admin' ? 'verified' : 'pending',
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'barbers' });
      res.json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to create barber' });
    }
  });

  app.patch('/api/barbers/:id', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const [existingBarber] = await db
        .select()
        .from(barbers)
        .where(eq(barbers.id, req.params.id))
        .limit(1);

      if (!existingBarber) {
        return res.status(404).json({ error: 'Barber not found' });
      }

      const [barberShop] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, existingBarber.shopId))
        .limit(1);

      const isOwner = barberShop && barberShop.ownerUid === req.user!.uid;
      const isSelf = existingBarber.userUid === req.user!.uid;
      if (req.user!.role !== 'admin' && !isOwner && !isSelf) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to modify this barber chair.',
        });
      }

      const updateData: Record<string, unknown> = {};
      for (const k of [
        'name',
        'role',
        'specialty',
        'bio',
        'experienceYears',
        'priceFrom',
        'active',
        'chairBreakActive',
        'nextAvailable',
        'assignedServiceIds',
      ]) {
        if (req.body[k] !== undefined) updateData[k] = req.body[k];
      }

      // Only admins can alter verification status or verified status
      if (req.user!.role === 'admin') {
        if (req.body.verified !== undefined) updateData.verified = Boolean(req.body.verified);
        if (req.body.verificationStatus !== undefined) {
          updateData.verificationStatus = req.body.verificationStatus;
          if (req.body.verificationStatus === 'suspended') {
            updateData.active = false;
          } else if (req.body.verificationStatus === 'verified') {
            updateData.active = true;
            updateData.verified = true;
          }
        }
      }

      const [updated] = await db
        .update(barbers)
        .set(updateData)
        .where(eq(barbers.id, req.params.id))
        .returning();

      if (req.user!.role === 'admin' && req.body.verificationStatus === 'suspended') {
        const suspensionReason =
          req.body.suspensionReason || 'Administrative suspension';
        const appointmentAction = req.body.appointmentAction || 'flag';
        const reassignBarberId = req.body.reassignBarberId;
        const reassignBarberName =
          req.body.reassignBarberName || 'Salon Master Barber';

        // 1. Synchronize user profile status to suspended
        if (updated?.userUid) {
          await db
            .update(profiles)
            .set({ status: 'suspended' })
            .where(eq(profiles.uid, updated.userUid))
            .catch(() => {});
        }

        // 2. Handle affected upcoming appointments
        const affectedApts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.barberId, req.params.id),
              or(
                eq(appointments.status, 'confirmed'),
                eq(appointments.status, 'pending')
              )
            )
          )
          .catch(() => []);

        for (const apt of affectedApts) {
          if (appointmentAction === 'cancel') {
            await db
              .update(appointments)
              .set({
                status: 'cancelled',
                notes: `${apt.notes || ''} [Cancelled by Salon: Barber chair suspended]`.trim(),
              })
              .where(eq(appointments.id, apt.id))
              .catch(() => {});

            if (apt.customerUid) {
              await db
                .insert(notifications)
                .values({
                  id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  recipientUid: apt.customerUid,
                  type: 'appointment_cancelled',
                  title: `Appointment Cancelled: ${apt.shopName}`,
                  timeLabel: 'Just now',
                  unread: true,
                })
                .catch(() => {});
            }
          } else if (appointmentAction === 'reassign' && reassignBarberId) {
            await db
              .update(appointments)
              .set({
                barberId: reassignBarberId,
                barberName: reassignBarberName,
                notes: `${apt.notes || ''} [Reassigned from suspended chair]`.trim(),
              })
              .where(eq(appointments.id, apt.id))
              .catch(() => {});

            if (apt.customerUid) {
              await db
                .insert(notifications)
                .values({
                  id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  recipientUid: apt.customerUid,
                  type: 'appointment_updated',
                  title: `Appointment Reassigned: ${reassignBarberName} (${apt.shopName})`,
                  timeLabel: 'Just now',
                  unread: true,
                })
                .catch(() => {});
            }
          }
        }

        // 3. Notify the suspended barber with explicit reason
        if (updated?.userUid) {
          await db
            .insert(notifications)
            .values({
              id: `notif-${Date.now()}`,
              recipientUid: updated.userUid,
              type: 'account_suspended',
              title: `Account Notice: Chair Suspended (${suspensionReason})`,
              timeLabel: 'Just now',
              unread: true,
            })
            .catch(() => {});
        }
      } else if (req.user!.role === 'admin' && req.body.verificationStatus === 'verified') {
        // Reinstatement: Restore user profile to active
        if (updated?.userUid) {
          await db
            .update(profiles)
            .set({ status: 'active' })
            .where(eq(profiles.uid, updated.userUid))
            .catch(() => {});

          await db
            .insert(notifications)
            .values({
              id: `notif-${Date.now()}`,
              recipientUid: updated.userUid,
              type: 'account_reinstated',
              title: 'Account Notice: Chair Reinstated & Verified',
              timeLabel: 'Just now',
              unread: true,
            })
            .catch(() => {});
        }
      }

      broadcastEvent('state:updated', { entity: 'barbers' });
      broadcastEvent('state:updated', { entity: 'profiles' });
      broadcastEvent('state:updated', { entity: 'appointments' });
      broadcastEvent('state:updated', { entity: 'notifications' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update barber' });
    }
  });

  app.delete(
    '/api/barbers/:id',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const [existingBarber] = await db
          .select()
          .from(barbers)
          .where(eq(barbers.id, req.params.id))
          .limit(1);

        if (!existingBarber) {
          return res.status(404).json({ error: 'Barber not found' });
        }

        const [barberShop] = await db
          .select()
          .from(shops)
          .where(eq(shops.id, existingBarber.shopId))
          .limit(1);

        if (req.user!.role !== 'admin' && barberShop?.ownerUid !== req.user!.uid) {
          return res.status(403).json({
            error: 'Forbidden: You do not own the shop for this barber.',
          });
        }

        await db.delete(barbers).where(eq(barbers.id, req.params.id));
        broadcastEvent('state:updated', { entity: 'barbers' });
        res.json({ ok: true });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to remove barber' });
      }
    }
  );

  // 8. Shops Management (Ownership Enforced)
  app.post('/api/shops', requireAuth, async (req: AuthRequest, res) => {
    try {
      const coordCheck = validateCoordinates(req.body.latitude, req.body.longitude);
      if (!coordCheck.valid) {
        return res.status(400).json({ error: coordCheck.error });
      }

      const id = `shop-${Date.now()}`;
      const [created] = await db
        .insert(shops)
        .values({
          id,
          ownerUid: req.user!.uid,
          name: req.body.name,
          stateId: req.body.stateId || req.body.state_id || 'st-pb',
          cityId: req.body.cityId || req.body.city_id || 'ct-jal',
          state: req.body.state || 'Punjab',
          city: req.body.city || 'Jalandhar',
          district:
            req.body.district ||
            `${req.body.city || 'Jalandhar'}, ${req.body.state || 'Punjab'}`,
          address: req.body.address || '',
          phone: req.body.phone || '+91',
          distance: '1.0 km away',
          distanceMilesTenths: 10,
          rating: '5.0',
          reviewCount: 0,
          isOpen: true,
          closesAt: req.body.closesAt || '21:30',
          priceTier: req.body.priceTier || '₹500 – ₹1,500',
          minPrice: Number(req.body.minPrice) || 500,
          verified: req.user!.role === 'admin',
          approvalStatus: req.user!.role === 'admin' ? 'approved' : 'pending',
          logoUrl: '',
          image: req.body.image || ASSETS.royalInterior,
          tagline: req.body.tagline || 'Bespoke Grooming & Reserved Appointments',
          about:
            req.body.about ||
            'Verified partner barbershop on the BarberLoo network.',
          qrCodeSlug: id,
          latitude: coordCheck.lat !== undefined ? coordCheck.lat : '',
          longitude: coordCheck.lng !== undefined ? coordCheck.lng : '',
          pinCode: req.body.pinCode || req.body.pin_code || '',
          landmark: req.body.landmark || '',
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'shops' });
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create shop' });
    }
  });

  app.patch('/api/shops/:id', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const [shopRecord] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, req.params.id))
        .limit(1);

      if (!shopRecord) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      if (req.user!.role !== 'admin' && shopRecord.ownerUid !== req.user!.uid) {
        return res.status(403).json({
          error: 'Forbidden: You do not own this shop.',
        });
      }

      if (req.body.latitude !== undefined || req.body.longitude !== undefined) {
        const check = validateCoordinates(req.body.latitude, req.body.longitude);
        if (!check.valid) {
          return res.status(400).json({ error: check.error });
        }
      }

      const updateData: Record<string, unknown> = {};
      for (const k of [
        'name',
        'district',
        'city',
        'state',
        'stateId',
        'cityId',
        'address',
        'phone',
        'isOpen',
        'closesAt',
        'tagline',
        'about',
        'priceTier',
        'minPrice',
        'image',
        'logoUrl',
        'latitude',
        'longitude',
        'pinCode',
        'landmark',
      ]) {
        if (req.body[k] !== undefined) {
          updateData[k] = req.body[k];
        }
      }
      if (req.body.pin_code !== undefined && req.body.pinCode === undefined) {
        updateData.pinCode = req.body.pin_code;
      }

      // Only admins can alter verified or approvalStatus
      if (req.user!.role === 'admin') {
        if (req.body.verified !== undefined) updateData.verified = Boolean(req.body.verified);
        if (req.body.approvalStatus !== undefined) updateData.approvalStatus = req.body.approvalStatus;
      }

      const [updated] = await db
        .update(shops)
        .set(updateData)
        .where(eq(shops.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'shops' });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update shop' });
    }
  });

  app.get('/api/shops/:id', async (req, res) => {
    try {
      const cleanId = (req.params.id || '').trim();
      if (!cleanId) return res.status(400).json({ error: 'Shop ID required' });

      let shopRecord: any = (
        await db
          .select()
          .from(shops)
          .where(or(eq(shops.id, cleanId), eq(shops.qrCodeSlug, cleanId)))
          .limit(1)
      )[0];

      if (!shopRecord) {
        // Fallback: match by slugified name or case-insensitive
        const allShops = await db.select().from(shops);
        shopRecord = allShops.find(
          (s) =>
            s.id.toLowerCase() === cleanId.toLowerCase() ||
            (s.qrCodeSlug && s.qrCodeSlug.toLowerCase() === cleanId.toLowerCase()) ||
            s.name
              ?.toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') === cleanId.toLowerCase()
        );
      }

      if (!shopRecord) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      const pSettings = await getPlatformSettings();
      const domain = pSettings?.customDomain || 'https://barberloo.in';
      const cleanSlug =
        shopRecord.qrCodeSlug ||
        shopRecord.name
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') ||
        shopRecord.id;

      const shopServices = await db
        .select()
        .from(services)
        .where(eq(services.shopId, shopRecord.id));

      const shopBarbers = await db
        .select()
        .from(barbers)
        .where(eq(barbers.shopId, shopRecord.id));

      res.json({
        shop: {
          ...shopRecord,
          slug: cleanSlug,
          permalink: `${domain}/shop/${cleanSlug}/`,
          qrCodeUrl: `${domain}/shop/${cleanSlug}/`,
          legacyBookingUrl: `${domain}/booking.html?shop_id=${encodeURIComponent(shopRecord.id)}`,
        },
        services: shopServices,
        barbers: shopBarbers,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch shop details' });
    }
  });

  // 9. Working Hours / Salon Schedule (Ownership Enforced)
  app.patch(
    '/api/working-hours/:id',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
        const [whRecord] = await db
          .select()
          .from(workingHours)
          .where(eq(workingHours.id, req.params.id))
          .limit(1);

        if (!whRecord) {
          return res.status(404).json({ error: 'Working hours schedule not found' });
        }

        const [whShop] = await db
          .select()
          .from(shops)
          .where(eq(shops.id, whRecord.shopId))
          .limit(1);

        if (req.user!.role !== 'admin' && whShop?.ownerUid !== req.user!.uid) {
          return res.status(403).json({
            error: 'Forbidden: You do not own the shop for these working hours.',
          });
        }

        const updateData: Record<string, unknown> = {};
        for (const k of [
          'startTime',
          'endTime',
          'breakStart',
          'breakEnd',
          'isDayOff',
          'holidayNote',
        ]) {
          if (req.body[k] !== undefined) updateData[k] = req.body[k];
        }
        const [updated] = await db
          .update(workingHours)
          .set(updateData)
          .where(eq(workingHours.id, req.params.id))
          .returning();

        broadcastEvent('state:updated', { entity: 'workingHours' });
        res.json(updated);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to update schedule' });
      }
    }
  );

  // 10. Reviews (Completed Appointment Verification Enforced, Section 28)
  app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerUid = req.user!.uid;
      const targetShopId = req.body.shopId || 'shop-1';
      const rating = Math.min(5, Math.max(1, Math.round(Number(req.body.rating) || 5)));

      // Section 28: Customer can review ONLY after a legitimate completed appointment belonging to them
      if (req.body.appointmentId) {
        const [apt] = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, req.body.appointmentId))
          .limit(1);

        if (!apt) {
          return res.status(404).json({ error: 'Appointment not found.' });
        }

        if (apt.customerUid !== customerUid && req.user!.role !== 'admin') {
          return res.status(403).json({
            error: 'Forbidden: You may only review your own appointment.',
          });
        }

        if (apt.status !== 'completed') {
          return res.status(403).json({
            error: 'Only completed appointments may receive a verified review.',
          });
        }

        // Prevent duplicate review for the same appointment
        const existingRev = await db
          .select()
          .from(reviews)
          .where(eq(reviews.appointmentId, req.body.appointmentId));
        if (existingRev.length > 0) {
          return res.status(400).json({
            error: 'A review has already been submitted for this appointment.',
          });
        }
      } else {
        // If appointmentId not provided directly, verify user has at least one completed appointment at this shop
        const userApts = await db
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.customerUid, customerUid),
              eq(appointments.shopId, targetShopId)
            )
          );
        const hasCompleted = userApts.some((a) => a.status === 'completed');
        if (!hasCompleted) {
          return res.status(403).json({
            error:
              'Only clients with a completed appointment at this salon may submit a verified review.',
          });
        }
      }

      const [created] = await db
        .insert(reviews)
        .values({
          id: `rev-${Date.now()}`,
          appointmentId: req.body.appointmentId || '',
          customerUid,
          author: req.user!.name || req.body.author || 'Private Client',
          role: 'Verified Client',
          organization: 'Member',
          shopId: targetShopId,
          barberId: req.body.barberId || 'brb-1',
          barberName: req.body.barberName || '',
          serviceName: req.body.serviceName || '',
          rating,
          date: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
          comment: String(req.body.comment || '').trim(),
          outcome: 'Verified Salon Visit',
          status: 'published',
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'reviews' });
      res.json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to submit review' });
    }
  });

  app.patch('/api/reviews/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const requester = req.user!;
      const [existing] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.id, req.params.id));

      if (!existing) {
        return res.status(404).json({ error: 'Review not found' });
      }

      // Only author or admin can modify
      if (existing.customerUid !== requester.uid && requester.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden: You may only modify your own reviews.',
        });
      }

      const updateData: Record<string, unknown> = {};
      if (req.body.comment !== undefined) updateData.comment = req.body.comment;
      if (req.body.rating !== undefined)
        updateData.rating = Number(req.body.rating);

      // Only admin can modify moderation status and note
      if (requester.role === 'admin') {
        if (req.body.status !== undefined) updateData.status = req.body.status;
        if (req.body.moderationNote !== undefined)
          updateData.moderationNote = req.body.moderationNote;
      }

      const [updated] = await db
        .update(reviews)
        .set(updateData)
        .where(eq(reviews.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'reviews' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update review' });
    }
  });

  // 11. Favorites Toggle (Requires Auth)
  app.post(
    '/api/favorites/toggle',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const customerUid = req.user!.uid;
        const { targetType, targetId } = req.body;

        const existing = await db
          .select()
          .from(favorites)
          .where(eq(favorites.customerUid, customerUid));

        const match = existing.find(
          (f) => f.targetType === targetType && f.targetId === targetId
        );

        if (match) {
          await db.delete(favorites).where(eq(favorites.id, match.id));
        } else {
          await db.insert(favorites).values({
            id: `fav-${Date.now()}`,
            customerUid,
            targetType,
            targetId,
          });
        }

        const updatedFavs = await db
          .select()
          .from(favorites)
          .where(eq(favorites.customerUid, customerUid));
        broadcastEvent('state:updated', { entity: 'favorites' });
        res.json(updatedFavs);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to toggle favorite' });
      }
    }
  );

  // 12. Mark Notifications Read (Requires Auth)
  app.post(
    '/api/notifications/read',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const customerUid = req.user!.uid;
        await db
          .update(notifications)
          .set({ unread: false })
          .where(eq(notifications.recipientUid, customerUid));
        broadcastEvent('state:updated', { entity: 'notifications' });
        res.json({ ok: true });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to mark notifications read' });
      }
    }
  );

  // 14. Coupons CRUD (Barber / Shop Owner / Admin with Ownership Enforcement)
  app.post('/api/coupons', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const shopId = req.body.shopId || 'shop-1';
      const [shopRecord] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, shopId))
        .limit(1);

      if (!shopRecord) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      if (req.user!.role !== 'admin' && shopRecord.ownerUid !== req.user!.uid) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission to create coupons for this shop.',
        });
      }

      const pct = Math.min(50, Math.max(5, Number(req.body.discountPercent) || 15));
      const [created] = await db
        .insert(coupons)
        .values({
          id: `cpn-${Date.now()}`,
          shopId,
          code: String(req.body.code).trim().toUpperCase(),
          discountText:
            req.body.discountText || `${pct}% Off Salon Services`,
          discountPercent: pct,
          minSpend: Number(req.body.minSpend) || 500,
          usesCount: 0,
          maxUses: Number(req.body.maxUses) || 250,
          status: 'Active',
          expiresAt: req.body.expiresAt || '2027-01-31',
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'coupons' });
      res.json(created);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || 'Failed to create coupon' });
    }
  });

  app.patch('/api/coupons/:id', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const [couponRecord] = await db
        .select()
        .from(coupons)
        .where(eq(coupons.id, req.params.id))
        .limit(1);

      if (!couponRecord) {
        return res.status(404).json({ error: 'Coupon not found' });
      }

      const [couponShop] = await db
        .select()
        .from(shops)
        .where(eq(shops.id, couponRecord.shopId))
        .limit(1);

      if (req.user!.role !== 'admin' && couponShop?.ownerUid !== req.user!.uid) {
        return res.status(403).json({
          error: 'Forbidden: You do not own the shop for this coupon.',
        });
      }

      const updateData: Record<string, unknown> = {};
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.discountPercent !== undefined)
        updateData.discountPercent = Number(req.body.discountPercent);
      if (req.body.minSpend !== undefined)
        updateData.minSpend = Number(req.body.minSpend);
      if (req.body.expiresAt !== undefined)
        updateData.expiresAt = req.body.expiresAt;

      const [updated] = await db
        .update(coupons)
        .set(updateData)
        .where(eq(coupons.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'coupons' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update coupon' });
    }
  });

  // 15. Reports & Moderation
  app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const [created] = await db
        .insert(reports)
        .values({
          id: `rep-${Date.now()}`,
          reporterUid: req.user!.uid,
          reporterName: req.user!.name || 'Client',
          targetType: req.body.targetType || 'shop',
          targetId: req.body.targetId || 'shop-1',
          targetLabel: req.body.targetLabel || 'Salon Report',
          reason: req.body.reason || 'General Report',
          details: req.body.details || '',
          status: 'open',
        })
        .returning();

      broadcastEvent('state:updated', { entity: 'reports' });
      res.json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to submit report' });
    }
  });

  app.patch('/api/reports/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.resolutionNote !== undefined)
        updateData.resolutionNote = req.body.resolutionNote;

      const [updated] = await db
        .update(reports)
        .set(updateData)
        .where(eq(reports.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'reports' });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Failed to update report' });
    }
  });

  // 16. Payments Settlement / Refund Update (Admin Only)
  app.patch(
    '/api/payments/:id',
    requireAdmin,
    async (req: AuthRequest, res) => {
      try {
        const [updated] = await db
          .update(payments)
          .set({ status: req.body.status })
          .where(eq(payments.id, req.params.id))
          .returning();

        broadcastEvent('state:updated', { entity: 'payments' });
        res.json(updated);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to update payment' });
      }
    }
  );

  // 16b. Platform Fee Configuration Endpoints
  app.get('/api/platform/fee', async (_req, res) => {
    try {
      const settings = await getPlatformSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch platform fee settings' });
    }
  });

  app.patch('/api/platform/fee', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const updated = await updatePlatformSettingsInDb(req.body);
      broadcastEvent('state:updated', { entity: 'platformSettings', settings: updated });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update platform fee settings' });
    }
  });

  // 16c. Authoritative Server-side Price Calculation API
  app.post('/api/pricing/calculate', async (req, res) => {
    try {
      const { serviceId, couponCode } = req.body;
      if (!serviceId) {
        return res.status(400).json({ error: 'Service ID is required' });
      }
      const pricing = await calculateServerBookingPrice(serviceId, couponCode);
      res.json(pricing);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to calculate pricing' });
    }
  });

  // 17. Razorpay Order Creation (Server-calculated Total Price Only)
  app.post(
    '/api/payments/razorpay/create-order',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const { serviceId, couponCode, receipt, notes } = req.body;
        if (!serviceId) {
          return res.status(400).json({ error: 'serviceId is required to create a booking payment order' });
        }

        // Authoritative Server-side Price & Fee Calculation
        const pricing = await calculateServerBookingPrice(serviceId, couponCode);
        const serverTotalAmount = pricing.totalAmount; // in INR rupees
        const orderAmountPaise = Math.round(serverTotalAmount * 100); // in paise

        const keyId =
          process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (keyId && keySecret && !keyId.includes('YOUR_KEY_ID')) {
          const Razorpay = (await import('razorpay')).default;
          const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
          });

          const order = await razorpay.orders.create({
            amount: orderAmountPaise,
            currency: 'INR',
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: {
              ...(notes || {}),
              serviceId: pricing.serviceId,
              serviceName: pricing.serviceName,
              servicePrice: String(pricing.servicePrice),
              platformFee: String(pricing.platformFee),
              discountAmount: String(pricing.discountAmount),
              totalAmount: String(pricing.totalAmount),
            },
          });

          return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            servicePrice: pricing.servicePrice,
            platformFee: pricing.platformFee,
            discountAmount: pricing.discountAmount,
            totalAmount: pricing.totalAmount,
            currency: 'INR',
            keyId,
          });
        }

        // When server-side order cannot be created via Razorpay API, return clean credentials without
        // a fake orderId so Razorpay Checkout opens standard checkout mode safely without crashing.
        res.json({
          success: true,
          orderId: undefined,
          amount: orderAmountPaise,
          servicePrice: pricing.servicePrice,
          platformFee: pricing.platformFee,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.totalAmount,
          currency: 'INR',
          keyId: keyId || 'rzp_live_Tu5l5vmBvE6xHW',
        });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: err.message || 'Failed to create Razorpay order' });
      }
    }
  );

  // 18. Razorpay Verify Signature API (Requires Auth)
  app.post(
    '/api/payments/razorpay/verify',
    optionalAuth,
    async (req: AuthRequest, res) => {
      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        } = req.body;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        // In production, reject unverified payments if key secret is missing
        if (process.env.NODE_ENV === 'production') {
          if (!keySecret || keySecret.includes('YOUR_RAZORPAY_SECRET')) {
            return res.status(500).json({
              verified: false,
              error: 'Razorpay payment verification secret is not configured on the production server.',
            });
          }
        } else if (!keySecret || keySecret.includes('YOUR_RAZORPAY_SECRET')) {
          if (!razorpay_signature || razorpay_signature === 'invalid_sig') {
            return res.status(400).json({
              verified: false,
              error: 'Invalid signature: Razorpay verification failed.',
            });
          }
          return res.json({
            verified: true,
            paymentId: razorpay_payment_id,
          });
        }

        const crypto = await import('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        const sigBuf = Buffer.from(razorpay_signature || '', 'hex');
        const expBuf = Buffer.from(expectedSignature, 'hex');
        const isAuthentic =
          sigBuf.length === expBuf.length &&
          crypto.timingSafeEqual(sigBuf, expBuf);

        if (isAuthentic) {
          res.json({ verified: true, paymentId: razorpay_payment_id });
        } else {
          res.status(400).json({
            verified: false,
            error: 'Invalid Razorpay payment signature',
          });
        }
      } catch (err: any) {
        res
          .status(500)
          .json({ error: err.message || 'Payment signature verification failed' });
      }
    }
  );

  // Mount Vite or Static Dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`BarberLoo Full-Stack Server listening on http://0.0.0.0:${PORT}`);
    syncSupabaseWithPostgres().catch((e) => console.warn('[Sync Error]', e));
  });
}

async function syncSupabaseWithPostgres() {
  try {
    const supaUrl = process.env.VITE_SUPABASE_URL || 'https://ddusvfylhifoniobzmcq.supabase.co';
    const supaKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bUpxVfRsVPz_d0qg1QrrNA_m7zM66t6';
    const res = await fetch(`${supaUrl}/rest/v1/shops?select=*`, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
      },
    });
    if (res.ok) {
      const remoteShops: any[] = await res.json();
      if (Array.isArray(remoteShops)) {
        for (const s of remoteShops) {
          const rawCity = s.city || 'Ludhiana';
          const cityId = rawCity.toLowerCase().includes('ludhiana') ? 'ct-lud' : 'ct-jal';
          const stateId = 'st-pb';

          await db
            .insert(shops)
            .values({
              id: s.id,
              ownerUid: s.owner_uid || '',
              name: s.name,
              stateId,
              cityId,
              state: 'Punjab',
              district: s.district || 'Ludhiana, Punjab',
              city: 'Ludhiana',
              address: s.address || 'Civil Lines, Ludhiana, Punjab',
              phone: s.phone || '+91 98765 43210',
              distance: s.distance || '1.2 km away',
              distanceMilesTenths: 12,
              rating: String(s.rating || '5.0'),
              reviewCount: s.review_count || 0,
              isOpen: s.is_open ?? true,
              closesAt: s.closes_at || '21:30',
              priceTier: s.price_tier || '₹60 – ₹150',
              minPrice: Number(s.min_price || 60),
              verified: s.verified ?? true,
              approvalStatus: s.approval_status || 'approved',
              logoUrl: s.logo_url || '',
              image: s.image || '',
              tagline: s.tagline || 'Luxury Grooming & Bespoke Appointments',
              about:
                s.about ||
                'Premier barbershop offering precision fades, hair sculpting and luxury grooming in Ludhiana.',
              qrCodeSlug: s.qr_code_slug || s.id,
            })
            .onConflictDoNothing();
        }
      }
    }

    const srvRes = await fetch(`${supaUrl}/rest/v1/services?select=*`, {
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
      },
    });
    if (srvRes.ok) {
      const remoteServices: any[] = await srvRes.json();
      if (Array.isArray(remoteServices)) {
        for (const srv of remoteServices) {
          await db
            .insert(services)
            .values({
              id: srv.id,
              shopId: srv.shop_id,
              indexCode: srv.index_code || '01',
              name: srv.name,
              category: srv.category || 'Precision Haircuts',
              durationMin: Number(srv.duration_min || 30),
              price: Number(srv.price || 100),
              description: srv.description || 'Bespoke grooming haircut service.',
              popular: srv.popular ?? true,
              active: srv.active ?? true,
              image: srv.image || '',
            })
            .onConflictDoNothing();
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] Background sync exception:', err);
  }
}

startServer();
