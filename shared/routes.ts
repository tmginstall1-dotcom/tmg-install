import { z } from 'zod';
import { 
  insertUserSchema, users,
  insertCustomerSchema, customers,
  insertCatalogItemSchema, catalogItems,
  insertQuoteSchema, quotes,
  insertQuoteItemSchema, quoteItems,
  insertJobUpdateSchema, jobUpdates,
  quoteRequestSchema,
  QuoteResponse
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.validation,
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.validation,
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() }),
      }
    }
  },
  catalog: {
    list: {
      method: 'GET' as const,
      path: '/api/catalog' as const,
      input: z.object({ search: z.string().optional() }).optional(),
      responses: { 200: z.array(z.custom<typeof catalogItems.$inferSelect>()) }
    }
  },
  quotes: {
    list: {
      method: 'GET' as const,
      path: '/api/quotes' as const,
      input: z.object({ status: z.string().optional() }).optional(),
      responses: { 200: z.array(z.custom<QuoteResponse>()) }
    },
    get: {
      method: 'GET' as const,
      path: '/api/quotes/:id' as const,
      responses: { 200: z.custom<QuoteResponse>(), 404: errorSchemas.notFound }
    },
    createFromCustomer: { // AI Quote generation
      method: 'POST' as const,
      path: '/api/quotes/request' as const,
      input: quoteRequestSchema,
      responses: { 201: z.custom<QuoteResponse>(), 400: errorSchemas.validation }
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/quotes/:id/status' as const,
      input: z.object({ status: z.string(), note: z.string().optional(), gpsLat: z.number().optional(), gpsLng: z.number().optional(), photoUrl: z.string().optional(), assignedStaffId: z.number().optional() }),
      responses: { 200: z.custom<QuoteResponse>(), 400: errorSchemas.validation }
    },
    updatePayment: {
      method: 'PATCH' as const,
      path: '/api/quotes/:id/payment' as const,
      input: z.object({ paymentType: z.enum(['deposit', 'final']), amount: z.string() }),
      responses: { 200: z.custom<QuoteResponse>() }
    },
    updateBooking: {
      method: 'PATCH' as const,
      path: '/api/quotes/:id/booking' as const,
      input: z.object({ scheduledAt: z.string(), timeWindow: z.string() }),
      responses: { 200: z.custom<QuoteResponse>() }
    },
    wizard: {
      method: 'POST' as const,
      path: '/api/quotes/wizard' as const,
      input: z.object({
        customer: z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(1),
        }),
        selectedServices: z.array(z.enum(['install', 'dismantle', 'relocate'])).min(1),
        serviceAddress: z.string().min(1),
        pickupAddress: z.string().optional(),
        dropoffAddress: z.string().optional(),
        accessDifficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        floorsInfo: z.string().optional(),
        items: z.array(z.object({
          catalogItemId: z.number().optional(),
          quantity: z.number().min(1),
          serviceType: z.enum(['install', 'dismantle', 'relocate']),
          unitPrice: z.number().min(0),
          itemName: z.string().min(1),
          sku: z.string().optional(),
        })),
        customItems: z.array(z.object({
          description: z.string().min(1),
          serviceType: z.enum(['install', 'dismantle', 'relocate']),
          quantity: z.number().min(1),
        })).optional(),
        logisticsFee: z.number().min(0).optional(),   // total of transport + floor + access surcharges
        discount: z.number().min(0).optional(),       // bulk discount amount
        distanceKm: z.number().min(0).optional(),     // auto-computed route distance (relocation only)
        detectedPhotoUrl: z.string().optional(), // compressed thumbnail from AI photo scan
      }),
      responses: { 201: z.custom<QuoteResponse>(), 400: errorSchemas.validation }
    }
  },
  distance: {
    calculate: {
      method: 'POST' as const,
      path: '/api/distance' as const,
      input: z.object({
        pickupAddress: z.string().min(1),
        dropoffAddress: z.string().min(1),
        pickupLat: z.number().optional(),
        pickupLng: z.number().optional(),
        dropoffLat: z.number().optional(),
        dropoffLng: z.number().optional(),
      }),
      responses: {
        200: z.object({ distanceKm: z.number(), routeFound: z.boolean(), error: z.string().optional() }),
      }
    }
  },
  staff: {
    list: {
      method: 'GET' as const,
      path: '/api/staff' as const,
      responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
