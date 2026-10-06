import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { eq } from 'drizzle-orm';
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
  rewards,
  reports,
  appointments,
} from './src/db/schema.ts';
import {
  getOrCreateUser,
  getBootstrapState,
  createBookingInDb,
  updateAppointmentInDb,
  resolveAllowedRole,
} from './src/db/users.ts';
import {
  requireAuth,
  requireBarberOrAdmin,
  requireAdmin,
  optionalAuth,
  AuthRequest,
} from './src/middleware/auth.ts';
import { ASSETS } from './src/data/barberlooData.ts';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

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

  // Support JSON payloads
  app.use(express.json({ limit: '50mb' }));
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

  // 1. Bootstrap State (Role-scoped data filtering)
  app.get('/api/bootstrap', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const activeUid = req.user?.uid || (req.query.uid as string) || '';
      const userRole = req.user?.role || 'customer';

      if (req.user?.uid && req.user?.email) {
        await getOrCreateUser(
          req.user.uid,
          req.user.email,
          req.user.name || req.user.email.split('@')[0]
        );
      }

      const data = await getBootstrapState(activeUid || undefined, req.user ? userRole : undefined);
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

  // 3. Update Profile / User Management (Ownership or Admin Authorization Required)
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

  // 4. Create Appointment (Require Verified Auth Session)
  app.post('/api/appointments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const requester = req.user!;
      const aptId = req.body.id || `apt-${Date.now()}`;

      // Retrieve customer profile for verified details
      const [userProf] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.uid, requester.uid))
        .limit(1);

      const clientName =
        userProf?.name || requester.name || req.body.clientName || 'Valued Client';
      const clientPhone =
        userProf?.phone || req.body.clientPhone || '+91';

      const created = await createBookingInDb({
        id: aptId,
        customerUid: requester.uid, // Authoritative verified user ID
        clientName,
        clientPhone,
        clientTier: userProf?.tier || 'Member',
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
        paymentMethod: req.body.paymentMethod || 'pay_at_shop',
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

  // 5. Update / Reschedule / Cancel / Complete Appointment
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

  // 6. Services CRUD (Barber / Shop Owner / Admin)
  app.post('/api/services', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const allSrv = await db.select().from(services);
      const nextIdx = String(allSrv.length + 1).padStart(2, '0');
      const [created] = await db
        .insert(services)
        .values({
          id: `srv-${Date.now()}`,
          shopId: req.body.shopId || 'shop-1',
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

  // 7. Barbers Team & Profile CRUD
  app.post('/api/barbers', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const [created] = await db
        .insert(barbers)
        .values({
          id: `brb-${Date.now()}`,
          shopId: req.body.shopId || 'shop-1',
          shopName: req.body.shopName || 'The Royal Barber',
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
          verified: true,
          verificationStatus: 'verified',
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
      const updateData: Record<string, unknown> = {};
      for (const k of [
        'name',
        'role',
        'specialty',
        'bio',
        'experienceYears',
        'priceFrom',
        'active',
        'verified',
        'verificationStatus',
        'chairBreakActive',
        'nextAvailable',
        'assignedServiceIds',
      ]) {
        if (req.body[k] !== undefined) updateData[k] = req.body[k];
      }

      const [updated] = await db
        .update(barbers)
        .set(updateData)
        .where(eq(barbers.id, req.params.id))
        .returning();

      broadcastEvent('state:updated', { entity: 'barbers' });
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

  // 8. Shops Management
  app.post('/api/shops', requireAuth, async (req: AuthRequest, res) => {
    try {
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
        'verified',
        'approvalStatus',
        'tagline',
        'about',
        'priceTier',
        'minPrice',
        'image',
        'logoUrl',
      ]) {
        if (req.body[k] !== undefined) {
          updateData[k] = req.body[k];
        }
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

  // 9. Working Hours / Salon Schedule
  app.patch(
    '/api/working-hours/:id',
    requireBarberOrAdmin,
    async (req: AuthRequest, res) => {
      try {
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

  // 10. Reviews (Completed Appointment Verification Enforced)
  app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const customerUid = req.user!.uid;

      // Verify that the user has at least one completed appointment
      const userApts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.customerUid, customerUid));
      const hasCompleted = userApts.some((a) => a.status === 'completed');
      if (!hasCompleted) {
        return res.status(403).json({
          error:
            'Only clients with a completed appointment may submit a verified review.',
        });
      }

      // Prevent duplicate review for the same appointment
      if (req.body.appointmentId) {
        const existingRev = await db
          .select()
          .from(reviews)
          .where(eq(reviews.appointmentId, req.body.appointmentId));
        if (existingRev.length > 0) {
          return res.status(400).json({
            error: 'A review has already been submitted for this appointment.',
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
          shopId: req.body.shopId || 'shop-1',
          barberId: req.body.barberId || 'brb-1',
          barberName: req.body.barberName || '',
          serviceName: req.body.serviceName || '',
          rating: Math.min(5, Math.max(1, Number(req.body.rating) || 5)),
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

  // 12. Loyalty Rewards Redemption (Requires Auth)
  app.post(
    '/api/rewards/redeem',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const customerUid = req.user!.uid;
        const cost = Number(req.body.cost) || 300;
        const label = req.body.label || 'Reward Redemption';

        const profList = await db
          .select()
          .from(profiles)
          .where(eq(profiles.uid, customerUid));
        const prof = profList[0];
        if (!prof || prof.rewardBalance < cost) {
          return res
            .status(400)
            .json({ error: 'Insufficient reward points balance.' });
        }

        const newBalance = prof.rewardBalance - cost;
        await db
          .update(profiles)
          .set({ rewardBalance: newBalance })
          .where(eq(profiles.uid, customerUid));

        await db.insert(rewards).values({
          id: `rew-${Date.now()}`,
          customerUid,
          pointsDelta: -cost,
          reason: `Redeemed: ${label}`,
          type: 'redeemed',
        });

        await db.insert(notifications).values({
          id: `notif-${Date.now()}`,
          recipientUid: customerUid,
          type: 'reward_redeemed',
          title: `Redeemed ${cost} PTS for ${label}`,
          timeLabel: 'Just now · Loyalty Desk',
          unread: true,
        });

        broadcastEvent('state:updated', { entity: 'rewards' });
        res.json({ rewardBalance: newBalance });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Failed to redeem reward' });
      }
    }
  );

  // 13. Mark Notifications Read (Requires Auth)
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

  // 14. Coupons CRUD (Barber / Shop Owner / Admin)
  app.post('/api/coupons', requireBarberOrAdmin, async (req: AuthRequest, res) => {
    try {
      const pct = Math.min(50, Math.max(5, Number(req.body.discountPercent) || 15));
      const [created] = await db
        .insert(coupons)
        .values({
          id: `cpn-${Date.now()}`,
          shopId: req.body.shopId || 'shop-1',
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

  // 17. Razorpay Order Creation (Requires Auth)
  app.post(
    '/api/payments/razorpay/create-order',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const { amount, currency = 'INR', receipt, notes } = req.body;
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
            amount: Math.round(Number(amount) * 100), // amount in paise
            currency,
            receipt: receipt || `rcpt_${Date.now()}`,
            notes: notes || {},
          });

          return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId,
          });
        }

        // Test Mode order fallback for local evaluation
        const simulatedOrderId = `order_${Date.now().toString(36)}${Math.random()
          .toString(36)
          .substring(2, 6)}`;
        res.json({
          success: true,
          orderId: simulatedOrderId,
          amount: Math.round(Number(amount) * 100),
          currency,
          keyId: keyId || 'rzp_test_barberloo_india',
          isSimulator: true,
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
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        } = req.body;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret || keySecret.includes('YOUR_RAZORPAY_SECRET')) {
          return res.json({
            verified: true,
            paymentId: razorpay_payment_id,
            isTest: true,
          });
        }

        const crypto = await import('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;
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
      server: { middlewareMode: true },
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
