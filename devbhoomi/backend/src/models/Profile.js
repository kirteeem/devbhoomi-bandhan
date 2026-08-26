import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, trim: true, maxlength: 100, default: null },

    dateOfBirth: Date,
    heightCm: Number,
    maritalStatus: { type: String, enum: ["never_married", "divorced", "widowed", "awaiting_divorce"] },
    manglik: { type: String, enum: ["yes", "no", "dont_know"], default: "dont_know" },

    district: {
      type: String,
      // "Other" covers members whose native district is outside Himachal
      // Pradesh (or who prefer not to specify one of the 12 official
      // districts) — see customDistrict below for the free-text detail that
      // goes with it. Without "Other" here, a wizard submission with
      // district: "Other" would fail Mongoose/Zod validation even though
      // the wizard itself offers and requires exactly that combination.
      enum: ["Shimla", "Mandi", "Kullu", "Kangra", "Hamirpur", "Una", "Bilaspur", "Solan", "Sirmaur", "Chamba", "Kinnaur", "Lahaul-Spiti", "Other"],
    },
    // Free-text district/state detail, only ever meaningful when
    // district === "Other" (e.g. "Kangra family, now settled in Delhi").
    customDistrict: { type: String, trim: true, maxlength: 100 },
    // Revenue tehsil within the chosen district (see constants/hpLocations.js
    // for the canonical list) — kept as free text rather than a DB-level enum
    // so "Other / Outside Himachal" profiles aren't blocked from saving one.
    tehsil: { type: String, trim: true, maxlength: 100 },
    // Village name within the tehsil. Free text — HP has ~20,000 villages,
    // far too many to responsibly hard-code as a dropdown (see constants file).
    village: { type: String, trim: true, maxlength: 100 },
    city: String,
    // Full postal/residential address (house no., street, locality, pincode).
    // Treated as sensitive contact info — only ever exposed via the gated
    // contact-details endpoint (see ContactUnlock / profileController.js),
    // never in the general profile response.
    address: { type: String, maxlength: 300, trim: true },
    currentResidenceCountry: { type: String, default: "India" },

    education: { degree: String, field: String, college: String },
    occupation: { title: String, company: String, annualIncomeRange: String },

    family: {
      fatherOccupation: String,
      motherOccupation: String,
      siblings: Number,
      familyType: { type: String, enum: ["nuclear", "joint"] },
      familyValues: { type: String, enum: ["traditional", "moderate", "liberal"] },
    },

    religion: { type: String, default: "Hindu" },
    caste: String,
    subCaste: String,
    gotra: String,

    lifestyle: {
      diet: { type: String, enum: ["vegetarian", "non_vegetarian", "eggetarian", "vegan"] },
      smoking: { type: String, enum: ["no", "occasionally", "yes"], default: "no" },
      drinking: { type: String, enum: ["no", "occasionally", "yes"], default: "no" },
    },

    horoscope: {
      birthTime: String,
      birthPlace: String,
      rashi: String,
      nakshatra: String,
      manglikDetail: String,
    },

    aboutMe: { type: String, maxlength: 1500 },
    interests: [String],

    photos: [
      {
        url: String,
        publicId: String,
        isProfilePhoto: { type: Boolean, default: false },
        isPrivate: { type: Boolean, default: false },
      },
    ],

    partnerPreference: {
      ageMin: Number,
      ageMax: Number,
      heightMinCm: Number,
      districts: [String],
      education: [String],
      maritalStatus: [String],
    },

    profileCompletion: { type: Number, default: 10 },
    visibility: { type: String, enum: ["public", "members_only", "hidden"], default: "members_only" },
  },
  { timestamps: true }
);

profileSchema.index({ user: 1 }, { unique: true });

profileSchema.index({ district: 1, "education.degree": 1 });
// Every browse/dashboard/suggestion query starts with
// { visibility: { $ne: "hidden" } } and sorts by createdAt/updatedAt —
// this index lets Mongo satisfy the filter+sort together instead of
// scanning + sorting in memory.
profileSchema.index({ visibility: 1, createdAt: -1 });
profileSchema.index({ visibility: 1, updatedAt: -1 });

export default mongoose.model("Profile", profileSchema);
