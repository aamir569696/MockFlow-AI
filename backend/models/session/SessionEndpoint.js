import mongoose from 'mongoose';

/**
 * SessionEndpoint — a single generated mock endpoint definition, scoped to a
 * guest session (NOT a User). This is the persistence-layer mirror of the
 * in-memory endpoint records held by SessionStore.
 *
 * Keyed on `sessionId` (the guest UUID) instead of an owner ObjectId, because
 * the mock runtime is guest-accessible and has no authenticated user.
 *
 * The (sessionId, slug, method) triple is unique: the mock router resolves a
 * definition by BOTH slug and HTTP method, so the same slug can carry a list
 * GET and a create POST as distinct documents.
 */
const sessionEndpointSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true, // mirror guestSession/mock.js UUID normalisation
      index: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    method: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*'],
      default: 'GET',
    },
    resource: {
      // Canonical resource name (e.g. "User") shared across CRUD slugs — used
      // as the collection key by the stateful collection engine.
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isCollection: {
      type: Boolean,
      default: false,
    },
    delayMs: {
      type: Number,
      default: 0,
    },
    // The per-resource JSON schema used to generate mock responses.
    schema: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Full generated definition blob (kept verbatim so the runtime can rehydrate
    // exactly what MockResolver produced without lossy field mapping).
    definition: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Method-aware uniqueness: one document per (session, slug, method).
sessionEndpointSchema.index({ sessionId: 1, slug: 1, method: 1 }, { unique: true });

export const SessionEndpoint = mongoose.model('SessionEndpoint', sessionEndpointSchema);
