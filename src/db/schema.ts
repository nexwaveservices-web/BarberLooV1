import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Core users table required by Firebase Auth <-> Cloud SQL linking
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 0a. states (Structured Location Hierarchy)
export const states = pgTable('states', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  code: text('code').notNull().unique(),
});

// 0b. cities (Belong to a state)
export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  stateId: text('state_id').notNull(),
  name: text('name').notNull(),
});

// 1. profiles
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  avatarUrl: text('avatar_url').notNull().default(''),
  role: text('role').notNull().default('customer'), // customer | barber | shop_owner | admin
  stateId: text('state_id').default('st-pb'),
  cityId: text('city_id').default('ct-jal'),
  state: text('state').default('Punjab'),
  city: text('city').default('Jalandhar'),
  preferredNotes: text('preferred_notes').notNull().default(''),
  status: text('status').notNull().default('active'), // active | suspended
  assignedShopId: text('assigned_shop_id').default('shop-1'),
  assignedBarberId: text('assigned_barber_id').default('brb-1'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. shops
export const shops = pgTable('shops', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull().default(''),
  name: text('name').notNull(),
  stateId: text('state_id').notNull().default('st-pb'),
  cityId: text('city_id').notNull().default('ct-jal'),
  state: text('state').notNull().default('Punjab'),
  district: text('district').notNull(),
  city: text('city').notNull().default('Jalandhar'),
  address: text('address').notNull(),
  phone: text('phone').notNull().default('+91 73555 42644'),
  distance: text('distance').notNull().default('Nearby'),
  distanceMilesTenths: integer('distance_miles_tenths').notNull().default(10),
  rating: text('rating').notNull().default('5.0'),
  reviewCount: integer('review_count').notNull().default(0),
  isOpen: boolean('is_open').notNull().default(true),
  closesAt: text('closes_at').notNull().default('21:30'),
  priceTier: text('price_tier').notNull().default('₹500 – ₹1,500'),
  minPrice: integer('min_price').notNull().default(500),
  verified: boolean('verified').notNull().default(true),
  approvalStatus: text('approval_status').notNull().default('approved'), // pending | approved | rejected | suspended
  logoUrl: text('logo_url').notNull().default(''),
  image: text('image').notNull(),
  tagline: text('tagline').notNull(),
  about: text('about').notNull(),
  qrCodeSlug: text('qr_code_slug').notNull().default('barberloo-india'),
  latitude: text('latitude').default(''),
  longitude: text('longitude').default(''),
  pinCode: text('pin_code').default(''),
  landmark: text('landmark').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. barbers
export const barbers = pgTable('barbers', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').default(''),
  shopId: text('shop_id').notNull().default('shop-1'),
  shopName: text('shop_name').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  rating: text('rating').notNull().default('5.0'),
  reviewCount: integer('review_count').notNull().default(0),
  experienceYears: integer('experience_years').notNull().default(5),
  specialty: text('specialty').notNull(),
  nextAvailable: text('next_available').notNull().default('Today · IST'),
  priceFrom: integer('price_from').notNull().default(500),
  image: text('image').notNull(),
  bio: text('bio').notNull(),
  featured: boolean('featured').notNull().default(true),
  active: boolean('active').notNull().default(true),
  verified: boolean('verified').notNull().default(true),
  verificationStatus: text('verification_status').notNull().default('verified'), // pending | verified | rejected | suspended
  chairBreakActive: boolean('chair_break_active').notNull().default(false),
  assignedServiceIds: text('assigned_service_ids')
    .notNull()
    .default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. services
export const services = pgTable('services', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull().default('shop-1'),
  indexCode: text('index_code').notNull().default('01'),
  name: text('name').notNull(),
  category: text('category').notNull().default('Hair'),
  durationMin: integer('duration_min').notNull().default(45),
  price: integer('price').notNull().default(500),
  description: text('description').notNull(),
  popular: boolean('popular').notNull().default(true),
  active: boolean('active').notNull().default(true),
  image: text('image').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 5. appointments
export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  customerUid: text('customer_uid').notNull(),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull().default('+91 73555 42644'),
  shopId: text('shop_id').notNull().default('shop-1'),
  shopName: text('shop_name').notNull(),
  barberId: text('barber_id').notNull(),
  barberName: text('barber_name').notNull(),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  durationMin: integer('duration_min').notNull().default(45),
  price: integer('price').notNull(),
  servicePrice: integer('service_price').notNull().default(150),
  platformFee: integer('platform_fee').notNull().default(10),
  totalPrice: integer('total_price').notNull().default(160),
  status: text('status').notNull().default('confirmed'), // pending | confirmed | in_progress | completed | cancelled | no_show
  paymentMethod: text('payment_method').notNull().default('online'), // strictly online (Razorpay)
  paymentStatus: text('payment_status').notNull().default('paid'), // pending | paid | refunded
  razorpayOrderId: text('razorpay_order_id').default(''),
  razorpayPaymentId: text('razorpay_payment_id').default(''),
  notes: text('notes').notNull().default(''),
  internalBarberNotes: text('internal_barber_notes').notNull().default(''),
  couponCode: text('coupon_code').notNull().default(''),
  completionOtpHash: text('completion_otp_hash').default(''),
  completionOtpSalt: text('completion_otp_salt').default(''),
  completionOtpCipher: text('completion_otp_cipher').default(''),
  completionOtpAttempts: integer('completion_otp_attempts').default(0),
  completionOtpMaxAttempts: integer('completion_otp_max_attempts').default(5),
  completionOtpExpiresAt: timestamp('completion_otp_expires_at'),
  completionOtpStatus: text('completion_otp_status').default('active'), // active | verified | expired | revoked
  completionVerifiedAt: timestamp('completion_verified_at'),
  completionVerifiedBy: text('completion_verified_by').default(''),
  payoutStatus: text('payout_status').default('pending_verification'), // unpaid | pending_verification | held | initiated | processed | settled | failed | reversed
  payoutHoldReason: text('payout_hold_reason').default(''),
  payoutHoldAppliedBy: text('payout_hold_applied_by').default(''),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('appointments_barber_date_idx').on(table.barberId, table.date),
  index('appointments_customer_uid_idx').on(table.customerUid),
  index('appointments_shop_date_idx').on(table.shopId, table.date),
  index('appointments_status_idx').on(table.status),
]);

// 6. reviews
export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').default(''),
  customerUid: text('customer_uid').notNull(),
  author: text('author').notNull(),
  role: text('role').notNull().default('Verified Client'),
  organization: text('organization').notNull().default('Member'),
  shopId: text('shop_id').notNull().default('shop-1'),
  barberId: text('barber_id').notNull().default('brb-1'),
  barberName: text('barber_name').notNull(),
  serviceName: text('service_name').notNull(),
  rating: integer('rating').notNull().default(5),
  date: text('date').notNull(),
  comment: text('comment').notNull(),
  outcome: text('outcome').notNull().default('Verified Salon Visit'),
  status: text('status').notNull().default('published'), // published | hidden | flagged
  moderationNote: text('moderation_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. favorites (with unique index to prevent duplicate favorites)
export const favorites = pgTable(
  'favorites',
  {
    id: text('id').primaryKey(),
    customerUid: text('customer_uid').notNull(),
    targetType: text('target_type').notNull(), // shop | barber
    targetId: text('target_id').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    uniqueIndex('favorites_customer_target_idx').on(
      table.customerUid,
      table.targetType,
      table.targetId
    ),
  ]
);

// 9. notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientUid: text('recipient_uid').notNull(),
  type: text('type').notNull().default('booking_confirmation'),
  title: text('title').notNull(),
  timeLabel: text('time_label').notNull(),
  unread: boolean('unread').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. working_hours
export const workingHours = pgTable('working_hours', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull().default('shop-1'),
  barberId: text('barber_id').default('brb-1'),
  dayOfWeek: text('day_of_week').notNull(),
  dayOrder: integer('day_order').notNull().default(1),
  startTime: text('start_time').notNull().default('09:00'),
  endTime: text('end_time').notNull().default('21:00'),
  breakStart: text('break_start').notNull().default('12:30'),
  breakEnd: text('break_end').notNull().default('13:15'),
  isDayOff: boolean('is_day_off').notNull().default(false),
  holidayNote: text('holiday_note').notNull().default(''),
  peakHours: text('peak_hours').notNull().default('17:00 – 19:30'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 11. shop_gallery
export const shopGallery = pgTable('shop_gallery', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull().default('shop-1'),
  imageUrl: text('image_url').notNull(),
  title: text('title').notNull(),
  caption: text('caption').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 12. barber_gallery
export const barberGallery = pgTable('barber_gallery', {
  id: text('id').primaryKey(),
  barberId: text('barber_id').notNull().default('brb-1'),
  imageUrl: text('image_url').notNull(),
  title: text('title').notNull(),
  styleTag: text('style_tag').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 13. payments (Complete online audit record)
export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').notNull(),
  customerUid: text('customer_uid').notNull(),
  clientName: text('client_name').notNull(),
  shopId: text('shop_id').notNull().default('shop-1'),
  shopName: text('shop_name').notNull(),
  amount: integer('amount').notNull(), // Total customer payment
  serviceAmount: integer('service_amount').notNull().default(0), // Barber service price
  platformFee: integer('platform_fee').notNull().default(10), // BarberLoo platform fee
  discountAmount: integer('discount_amount').notNull().default(0),
  totalAmount: integer('total_amount').notNull().default(0),
  currency: text('currency').notNull().default('INR'),
  provider: text('provider').notNull().default('razorpay'),
  providerOrderId: text('provider_order_id').default(''),
  providerPaymentId: text('provider_payment_id').default(''),
  method: text('method').notNull().default('online'), // strictly online
  methodDisplay: text('method_display')
    .notNull()
    .default('Razorpay Online (UPI / Card / NetBanking)'),
  status: text('status').notNull().default('paid'), // created | pending | paid | failed | refunded | partially_refunded
  receiptNumber: text('receipt_number').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 14. platform_settings (Configurable fixed or percentage fee)
export const platformSettings = pgTable('platform_settings', {
  id: text('id').primaryKey().default('default'),
  feeType: text('fee_type').notNull().default('fixed'), // fixed | percentage
  feeAmount: integer('fee_amount').notNull().default(10), // e.g. ₹10 fixed or 5 for 5%
  minFee: integer('min_fee').notNull().default(5),
  refundPolicy: text('refund_policy').notNull().default('service_only'), // service_only | full
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 14. coupons
export const coupons = pgTable('coupons', {
  id: text('id').primaryKey(),
  shopId: text('shop_id').notNull().default('shop-1'),
  code: text('code').notNull().unique(),
  discountText: text('discount_text').notNull(),
  discountPercent: integer('discount_percent').notNull(),
  minSpend: integer('min_spend').notNull().default(50),
  usesCount: integer('uses_count').notNull().default(0),
  maxUses: integer('max_uses').notNull().default(200),
  status: text('status').notNull().default('Active'), // Active | Paused
  expiresAt: text('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 15. reports
export const reports = pgTable('reports', {
  id: text('id').primaryKey(),
  reporterUid: text('reporter_uid').notNull(),
  reporterName: text('reporter_name').notNull(),
  targetType: text('target_type').notNull(), // shop | barber | customer | review
  targetId: text('target_id').notNull(),
  targetLabel: text('target_label').notNull(),
  reason: text('reason').notNull(),
  details: text('details').notNull(),
  status: text('status').notNull().default('open'), // open | investigating | resolved | dismissed
  resolutionNote: text('resolution_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

// 16. barber_payouts (Marketplace delayed transfer records)
export const barberPayouts = pgTable('barber_payouts', {
  id: text('id').primaryKey(),
  appointmentId: text('appointment_id').notNull().unique(),
  shopId: text('shop_id').notNull().default('shop-1'),
  barberId: text('barber_id').notNull(),
  barberName: text('barber_name').notNull(),
  customerUid: text('customer_uid').notNull(),
  grossAmount: integer('gross_amount').notNull(),
  platformFee: integer('platform_fee').notNull(),
  netPayoutAmount: integer('net_payout_amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('pending_verification'), // pending_verification | eligible | initiated | queued | processed | settled | failed | on_hold | reversed
  idempotencyKey: text('idempotency_key').notNull().unique(),
  provider: text('provider').notNull().default('razorpay_route'), // razorpay_route | razorpayx
  providerTransferId: text('provider_transfer_id').default(''),
  providerAccount: text('provider_account').default(''),
  failureReason: text('failure_reason').default(''),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetriedAt: timestamp('last_retried_at'),
  holdReason: text('hold_reason').default(''),
  heldBy: text('held_by').default(''),
  initiatedAt: timestamp('initiated_at'),
  settledAt: timestamp('settled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 17. financial_ledger (Immutable double-entry balanced accounting ledger)
export const financialLedger = pgTable('financial_ledger', {
  id: text('id').primaryKey(),
  entryNumber: integer('entry_number').notNull(),
  transactionId: text('transaction_id').notNull(),
  appointmentId: text('appointment_id').notNull(),
  account: text('account').notNull(), // customer_funds_escrow | platform_fee_revenue | barber_payable_pending | barber_payable_released | barber_payout_in_transit | barber_payout_settled | refunds_payable
  entryType: text('entry_type').notNull(), // DEBIT | CREDIT
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  referenceType: text('reference_type').notNull(), // customer_payment | otp_completion | payout_initiated | payout_settled | refund | adjustment
  referenceId: text('reference_id').notNull(),
  description: text('description').notNull(),
  metadataJson: text('metadata_json').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 18. webhook_events (Persistent idempotency tracking and audit trail for Razorpay webhooks)
export const webhookEvents = pgTable('webhook_events', {
  id: text('id').primaryKey(), // event_id (e.g. evt_xxxx)
  event: text('event').notNull(),
  provider: text('provider').notNull().default('razorpay'),
  entityId: text('entity_id').default(''),
  payloadJson: text('payload_json').default('{}'),
  status: text('status').notNull().default('processed'), // processed | error | ignored
  errorMessage: text('error_message').default(''),
  processedAt: timestamp('processed_at').defaultNow(),
});

// 19. barber_earnings_ledger (Reconciled accounting ledger for barber earnings and deductions)
export const barberEarningsLedger = pgTable(
  'barber_earnings_ledger',
  {
    id: text('id').primaryKey(),
    barberId: text('barber_id').notNull(),
    shopId: text('shop_id').notNull().default('shop-1'),
    appointmentId: text('appointment_id').default(''),
    transactionId: text('transaction_id').notNull(),
    transactionType: text('transaction_type').notNull(), // appointment_earnings | platform_fee | refund_adjustment | withdrawal_request | withdrawal_paid | withdrawal_reversal | manual_adjustment
    entryType: text('entry_type').notNull(), // CREDIT | DEBIT
    amount: integer('amount').notNull(), // in integer INR
    balanceAfter: integer('balance_after').notNull().default(0),
    status: text('status').notNull().default('available'), // pending | available | reserved | completed | cancelled | reversed
    description: text('description').notNull(),
    paymentReference: text('payment_reference').notNull().default(''),
    metadataJson: text('metadata_json').default('{}'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('barber_earnings_barber_id_idx').on(table.barberId),
    index('barber_earnings_status_idx').on(table.status),
    index('barber_earnings_created_at_idx').on(table.createdAt),
  ]
);

// 20. barber_withdrawal_requests (Lifecycle of barber payout withdrawal requests with strict ₹100 minimum)
export const barberWithdrawalRequests = pgTable(
  'barber_withdrawal_requests',
  {
    id: text('id').primaryKey(),
    barberId: text('barber_id').notNull(),
    shopId: text('shop_id').notNull().default('shop-1'),
    requestedAmount: integer('requested_amount').notNull(), // Min ₹100
    currency: text('currency').notNull().default('INR'),
    status: text('status').notNull().default('requested'), // requested | under_review | approved | processing | paid | rejected | failed | reversed
    beneficiaryId: text('beneficiary_id').default(''),
    bankName: text('bank_name').notNull(),
    accountHolderName: text('account_holder_name').notNull(),
    maskedAccountNumber: text('masked_account_number').notNull(),
    ifsc: text('ifsc').notNull(),
    payoutMode: text('payout_mode').notNull().default('manual_bank_transfer'), // razorpayx | manual_bank_transfer
    rejectionReason: text('rejection_reason').default(''),
    providerPayoutId: text('provider_payout_id').default(''),
    providerStatus: text('provider_status').default(''),
    utrReference: text('utr_reference').default(''),
    processedBy: text('processed_by').default(''),
    processedAt: timestamp('processed_at'),
    notes: text('notes').default(''),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('barber_withdrawals_barber_id_idx').on(table.barberId),
    index('barber_withdrawals_status_idx').on(table.status),
    index('barber_withdrawals_created_at_idx').on(table.createdAt),
  ]
);

// 21. barber_payout_beneficiaries (Secured bank accounts for payout disbursement)
export const barberPayoutBeneficiaries = pgTable(
  'barber_payout_beneficiaries',
  {
    id: text('id').primaryKey(),
    barberId: text('barber_id').notNull(),
    shopId: text('shop_id').notNull().default('shop-1'),
    accountHolderName: text('account_holder_name').notNull(),
    bankName: text('bank_name').notNull(),
    ifsc: text('ifsc').notNull(),
    accountNumberHash: text('account_number_hash').notNull(),
    maskedAccountNumber: text('masked_account_number').notNull(),
    encryptedAccountNumber: text('encrypted_account_number').default(''),
    isVerified: boolean('is_verified').notNull().default(false),
    isPrimary: boolean('is_primary').notNull().default(true),
    razorpayFundAccountId: text('razorpay_fund_account_id').default(''),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('barber_beneficiaries_barber_id_idx').on(table.barberId),
  ]
);

// 22. financial_audit_logs (Immutable audit logs for all financial operations)
export const financialAuditLogs = pgTable(
  'financial_audit_logs',
  {
    id: text('id').primaryKey(),
    actorUid: text('actor_uid').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    previousState: text('previous_state').default('{}'),
    newState: text('new_state').default('{}'),
    amount: integer('amount').default(0),
    notes: text('notes').default(''),
    ipAddress: text('ip_address').default(''),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('financial_audit_entity_idx').on(table.entityType, table.entityId),
    index('financial_audit_created_at_idx').on(table.createdAt),
  ]
);
