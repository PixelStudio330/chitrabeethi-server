const mongoose = require("mongoose");

const ArtworkSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Artwork title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Artwork description is required"],
    },
    price: {
      type: Number,
      required: [true, "Artwork price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Canvas", "Paper", "Painting", "Acrylic Art", "Sculpture", "Photography"],
    },
    img: {
      type: String,
      required: [true, "High-resolution image URL (imgBB) is required"],
    },
    tag: {
      type: String,
      required: [true, "Artwork sub-tag classification is required"], // e.g., "Original Acrylic", "Pure Watercolor"
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["available", "sold", "unpublished"],
      default: "available",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

ArtworkSchema.index({ name: "text", tag: "text" });
ArtworkSchema.index({ category: 1, status: 1 });
ArtworkSchema.index({ price: 1 });

module.exports = mongoose.model("Artwork", ArtworkSchema);