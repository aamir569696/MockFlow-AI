import mongoose from 'mongoose';

const responseConfigSchema = new mongoose.Schema(
  {
    statusCode: { type: Number, default: 200 },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
    delayMs: { type: Number, default: 0 },
    headers: { type: Map, of: String },
  },
  { _id: false }
);

const endpointSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    schema: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Keyed by HTTP method: GET, POST, PUT, PATCH, DELETE, *
    responses: {
      type: Map,
      of: responseConfigSchema,
      default: {},
    },
  },
  { timestamps: true }
);

// Compound index: one slug per user
endpointSchema.index({ owner: 1, slug: 1 }, { unique: true });

export const Endpoint = mongoose.model('Endpoint', endpointSchema);
