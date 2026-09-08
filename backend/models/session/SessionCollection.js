import mongoose from 'mongoose';

/**
 * SessionCollection — the live, mutable data buffer for a stateful collection
 * resource, scoped to a guest session. Persistence mirror of the in-memory
 * collections Map held by SessionStore.
 *
 * The stateful collection engine keys buffers by the canonical RESOURCE NAME
 * (lowercased) so that every CRUD slug for the same resource shares one buffer:
 *   GET  /users-list   → reads   collectionKey "user"
 *   POST /create-user  → appends collectionKey "user"
 *   DELETE /users-del  → splices collectionKey "user"
 *
 * `items` is stored as a Mixed array so arbitrary user-supplied keys (which may
 * fall outside the AI schema vocabulary) are preserved verbatim — matching the
 * in-memory engine's "user body is authoritative" contract.
 */
const sessionCollectionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    collectionKey: {
      // Canonical resource name, lowercased (definition.resource ?? slug).
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    items: {
      // Array of arbitrary documents; each item retains whatever keys it was
      // created with. Mixed avoids coercing/stripping custom fields.
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  { timestamps: true }
);

// One buffer per (session, resource).
sessionCollectionSchema.index({ sessionId: 1, collectionKey: 1 }, { unique: true });

export const SessionCollection = mongoose.model('SessionCollection', sessionCollectionSchema);
