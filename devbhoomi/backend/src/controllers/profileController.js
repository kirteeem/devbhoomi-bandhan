import { z } from "zod";
import Profile from "../models/Profile.js";
import User from "../models/User.js";
import ProfileView from "../models/ProfileView.js";
import Shortlist from "../models/Shortlist.js";
import ProfileUnlock from "../models/ProfileUnlock.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";
import { sendIdVerificationEmail } from "../utils/email.js";
import { isBlockedEitherWay } from "../utils/blockList.js";
import { ensureProfileForUser } from "../utils/ensureProfile.js";
import { computeCompletion, recalculateAndPersistCompletion } from "../utils/profileCompletion.js";

// Mirrors the wizard's editable fields. Anything not listed here is stripped,
// so a crafted request body can't set unexpected fields (e.g. profileCompletion).
export const updateProfileSchema = z.object({
  // Wizard "Save & Continue" sends the whole in-progress form on every step,
  // so a step reached before Date of Birth is filled in sends "" here — that
  // used to hit z.coerce.date() directly, which treats "" as an invalid date
  // (not an absent one) and 400s with "Invalid date" even though DOB is
  // meant to be optional for partial saves. Preprocessing "" / null to
  // undefined first lets `.optional()` actually do its job.
  dateOfBirth: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce
      .date()
      .refine((d) => {
        const ageMs = Date.now() - d.getTime();
        return ageMs / (365.25 * 24 * 60 * 60 * 1000) >= 18;
      }, "You must be at least 18 years old to create a profile")
      .optional()
  ),
  heightCm: z.number().min(100).max(250).optional(),
  maritalStatus: z.enum(["never_married", "divorced", "widowed", "awaiting_divorce"]).optional(),
  manglik: z.enum(["yes", "no", "dont_know"]).optional(),
  district: z.enum(["Shimla", "Mandi", "Kullu", "Kangra", "Hamirpur", "Una", "Bilaspur", "Solan", "Sirmaur", "Chamba", "Kinnaur", "Lahaul-Spiti", "Other"]).optional(),
  // Only meaningful when district === "Other" — see models/Profile.js.
  customDistrict: z.string().max(100).optional(),
  fullName: z.string().max(100).optional(),
  tehsil: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  // Full residential address — treated as sensitive contact info, see
  // ProfileUnlock. Required at profile-creation time on the frontend wizard,
  // optional here so partial draft saves (Save Progress) never fail.
  address: z.string().max(300).optional(),
  education: z.object({ degree: z.string().max(100).optional(), field: z.string().max(100).optional(), college: z.string().max(150).optional() }).optional(),
  occupation: z.object({ title: z.string().max(100).optional(), company: z.string().max(150).optional(), annualIncomeRange: z.string().max(50).optional() }).optional(),
  family: z
    .object({
      fatherOccupation: z.string().max(100).optional(),
      motherOccupation: z.string().max(100).optional(),
      siblings: z.number().min(0).max(20).optional(),
      familyType: z.enum(["nuclear", "joint"]).optional(),
      familyValues: z.enum(["traditional", "moderate", "liberal"]).optional(),
    })
    .optional(),
  religion: z.string().max(50).optional(),
  caste: z.string().max(50).optional(),
  subCaste: z.string().max(50).optional(),
  gotra: z.string().max(50).optional(),
  lifestyle: z
    .object({
      diet: z.enum(["vegetarian", "non_vegetarian", "eggetarian", "vegan"]).optional(),
      smoking: z.enum(["no", "occasionally", "yes"]).optional(),
      drinking: z.enum(["no", "occasionally", "yes"]).optional(),
    })
    .optional(),
  horoscope: z
    .object({
      birthTime: z.string().max(20).optional(),
      birthPlace: z.string().max(150).optional(),
      rashi: z.string().max(50).optional(),
      nakshatra: z.string().max(50).optional(),
      manglikDetail: z.string().max(300).optional(),
    })
    .optional(),
  aboutMe: z.string().max(1500).optional(),
  interests: z.array(z.string().max(50)).max(30).optional(),
  partnerPreference: z
    .object({
      ageMin: z.number().min(18).max(100).optional(),
      ageMax: z.number().min(18).max(100).optional(),
      heightMinCm: z.number().min(100).max(250).optional(),
      districts: z.array(z.string()).optional(),
      education: z.array(z.string()).optional(),
      maritalStatus: z.array(z.string()).optional(),
    })
    .optional(),
  visibility: z.enum(["public", "members_only", "hidden"]).optional(),
});

// The wizard's <select>/<input> fields default to "" (never undefined) until
// a member actively picks a value — see emptyWizardData in
// frontend/src/types/wizard.ts. Every field above is intentionally optional
// (so "Save Draft" always succeeds with a half-filled profile), but Zod's
// `.optional()` only treats `undefined` as "not provided" — an untouched
// enum field arriving as "" would otherwise fail with "Invalid enum value",
// surfacing as a confusing error on a field the wizard never marked
// required. Recursively drop empty strings before validating so only
// fields the member actually left blank are ever reported as invalid.
const stripEmptyStrings = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === "") continue;
      const cleaned = stripEmptyStrings(val);
      if (cleaned === undefined) continue;
      result[key] = cleaned;
    }
    return result;
  }
  return value;
};

// GET /api/profiles/me
export const getMyProfile = asyncHandler(async (req, res) => {
  await ensureProfileForUser(req.user._id);
  const profile = await Profile.findOne({ user: req.user._id })
    .populate("user", "fullName gender role profileCompletion profileCode phone")
    .lean();
  if (!profile) {
    res.status(404);
    throw new Error("Profile not found");
  }
  ok(res, {
    profile,
    quota: {
      planUnlocksRemaining: req.user.planUnlocksRemaining(),
      kundaliMatchesRemaining: req.user.kundaliMatchesRemaining(),
      freeUnlocksRemaining: req.user.freeUnlocksLeft(),
    },
  });
});

// GET /api/profiles/code/:code
export const getProfileByCode = asyncHandler(async (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const user = await User.findOne({ profileCode: code }).select("fullName gender profileCode").lean();
  if (!user) {
    res.status(404);
    throw new Error("No member found with that professional ID");
  }
  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error("That is your own professional ID");
  }

  const profile = await Profile.findOne({ user: user._id }).select("district").lean();
  ok(res, {
    profile: {
      userId: user._id,
      fullName: user.fullName,
      gender: user.gender,
      profileCode: user.profileCode,
      district: profile?.district,
    },
  });
});

// PATCH /api/profiles/me
export const updateMyProfile = asyncHandler(async (req, res) => {
  // Enforce Zod validation structure and safety
  const validatedUpdates = updateProfileSchema.parse(stripEmptyStrings(req.body));
  const nextFullName = validatedUpdates.fullName?.trim();
  if (nextFullName) {
    req.user.fullName = nextFullName;
    await req.user.save({ validateBeforeSave: false });
  }
  delete validatedUpdates.fullName;

  let profile = await Profile.findOneAndUpdate(
    { user: req.user._id }, 
    { $set: { ...validatedUpdates, name: req.user.fullName } }, 
    { new: true, upsert: true }
  );

  const completion = await recalculateAndPersistCompletion(profile, User);
  const populatedProfile = await Profile.findById(profile._id)
    .populate("user", "fullName gender role profileCompletion profileCode phone")
    .lean();

  // First time this profile is (near) fully complete, ask the priest /
  // verification team to manually cross-check the member's identity. Only
  // fires once per account (idVerificationEmailSent), so re-saving the
  // profile later never spams the priest's inbox.
  if (completion >= 90 && !req.user.idVerificationEmailSent) {
    try {
      await sendIdVerificationEmail({ user: req.user, profile });
    } catch (err) {
      console.error("Failed to send priest ID-verification email:", err.message);
    }
    req.user.idVerificationEmailSent = true;
    await req.user.save();
  }

  // Returned alongside `profile` (which already contains it) as a top-level
  // field too, so the frontend can pluck a single number straight off the
  // response and push it into the logged-in user's cached state without
  // needing to know the shape of the profile document.
  ok(res, { profile: populatedProfile || profile, profileCompletion: completion }, "Profile updated");
});

// GET /api/profiles/:userId/contact
// Returns address/phone/email ONLY if the requester has an active unlock —
// own profile, Premium membership (always-on access), or a spent free
// unlock. This mirrors detailsUnlocked in getProfileByUserId exactly, so
// "full details" and "contact info" are always unlocked together, by the
// same single action.
export const getContactDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const targetUser = await User.findById(userId).select("fullName email phone profileCode");
  if (!targetUser) {
    res.status(404);
    throw new Error("Profile not found");
  }

  const isOwnProfile = String(userId) === String(req.user._id);

  if (!isOwnProfile && (await isBlockedEitherWay(req.user._id, userId))) {
    res.status(404);
    throw new Error("Profile not found");
  }

  // Contact info requires an explicit unlock (a ProfileUnlock record) for
  // every member, Premium included — see unlockProfileDetails, which is the
  // only place that ever creates one, and only after the member has
  // confirmed a "Yes, view details" prompt on the frontend. Premium no
  // longer bypasses this on its own; it just gets its own quota (plan
  // credits) instead of the 5 lifetime free unlocks.
  const unlocked =
    isOwnProfile ||
    Boolean(
      await ProfileUnlock.findOne({
        viewer: req.user._id,
        unlockedUser: userId,
      })
    );

  if (!unlocked) {
    return ok(res, {
      contactUnlocked: false,
      freeUnlocksRemaining: req.user.freeUnlocksLeft(),
      planUnlocksRemaining: req.user.planUnlocksRemaining(),
    });
  }

  const targetProfile = await Profile.findOne({ user: userId }).select("address district city");

  ok(res, {
    contactUnlocked: true,
    contact: {
      fullName: targetUser.fullName,
      email: targetUser.email,
      phone: targetUser.phone,
      address: targetProfile?.address,
      district: targetProfile?.district,
      city: targetProfile?.city,
    },
    freeUnlocksRemaining: req.user.freeUnlocksLeft(),
    planUnlocksRemaining: req.user.planUnlocksRemaining(),
  });
});

// POST /api/profiles/:userId/contact/unlock
// Forwarding unlock contact details request directly to the unified profile unlock logic.
export const unlockContactDetails = asyncHandler(async (req, res) => {
  return unlockProfileDetails(req, res);
});

// GET /api/profiles/:userId
export const getProfileByUserId = asyncHandler(async (req, res) => {
  const targetUser = await User.findById(req.params.userId).select("_id");
  if (!targetUser) {
    res.status(404);
    throw new Error("Profile not found");
  }

  await ensureProfileForUser(targetUser._id);
  const profile = await Profile.findOne({ user: targetUser._id })
    .populate("user", "fullName gender isProfileVerified lastActiveAt profileCode")
    .lean();
  if (!profile || profile.visibility === "hidden") {
    res.status(404);
    throw new Error("Profile not found");
  }

  const isOwnProfile = String(profile.user._id) === String(req.user._id);

  if (!isOwnProfile && (await isBlockedEitherWay(req.user._id, profile.user._id))) {
    res.status(404);
    throw new Error("Profile not found");
  }

  const viewerIsPremium = req.user.isPremium();

  // IMPORTANT: Premium members no longer get contact info unlocked just by
  // opening this page. Previously `contactUnlocked` included
  // `viewerIsPremium` here, which meant simply viewing any profile silently
  // spent one of the member's 10 plan credits with no confirmation at all.
  // Premium members now go through the same explicit "Yes, view details" ->
  // POST /:userId/unlock confirmation step as everyone else (see
  // unlockProfileDetails below) — the only difference is what that unlock
  // costs them (a plan credit instead of a lifetime free unlock).
  const alreadyUnlocked = isOwnProfile
    ? true
    : Boolean(await ProfileUnlock.findOne({ viewer: req.user._id, unlockedUser: profile.user._id }));
  const contactUnlocked = isOwnProfile || alreadyUnlocked;
  // Kept for backwards compatibility with the frontend, which uses this to
  // decide whether to show the "Unlock" prompt.
  const detailsUnlocked = contactUnlocked;
  const restrictedView = !contactUnlocked;

  const full = profile;
  let age;
  if (full.dateOfBirth) {
    const ageMs = Date.now() - new Date(full.dateOfBirth).getTime();
    age = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  }

  // Until a member spends an unlock (free or Premium credit) on THIS
  // specific profile, they only get a matchmaking-preview slice back —
  // name, age, height, community (caste), religion, marital status, and
  // photos. Photos are shown to everyone regardless of unlock status;
  // everything else (about me, education/career, family, lifestyle,
  // horoscope, partner preferences, address) stays server-side until
  // unlocked. This used to also strip photos, which is what caused free
  // members to see a blurred/hidden gallery even past their unlock limit.
  let profileObj;
  if (restrictedView) {
    profileObj = {
      _id: full._id,
      user: full.user,
      age,
      heightCm: full.heightCm,
      maritalStatus: full.maritalStatus,
      religion: full.religion,
      caste: full.caste, // shown to members as "Community"
      photos: full.photos,
    };
  } else {
    profileObj = { ...full, age };
  }

  if (!isOwnProfile) {
    const recentView = await ProfileView.findOne({
      viewer: req.user._id,
      viewedUser: profile.user._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
    });
    if (!recentView) {
      await ProfileView.create({ viewer: req.user._id, viewedUser: profile.user._id });
    }
    // No quota is spent here anymore — merely recording that a view
    // happened. Credits (free or Premium plan) are only ever spent inside
    // unlockProfileDetails, once the member has explicitly confirmed they
    // want to see this person's full details.
  }

  const isShortlisted = isOwnProfile
    ? false
    : Boolean(await Shortlist.findOne({ user: req.user._id, shortlistedUser: profile.user._id }));

  ok(res, {
    profile: profileObj,
    restrictedView,
    isOwnProfile,
    isShortlisted,
    viewerIsPremium,
    planUnlocksRemaining: req.user.planUnlocksRemaining(),
    detailsUnlocked,
    contactUnlocked,
    freeUnlocksRemaining: req.user.freeUnlocksLeft(),
  });
});

// POST /api/profiles/:userId/unlock
// The single unlock action for a profile — spending it reveals BOTH the
// full profile details AND contact info (phone/email/address) together,
// permanently. There is intentionally only one button/endpoint for this:
//   - Premium members: still get every profile unlocked, but this now has
//     to be an explicit action — the member taps "Yes, view details" on a
//     confirmation prompt first (see ProfilePreview.tsx). That confirmed
//     click is what spends one of their 10 plan credits; simply opening a
//     profile page no longer spends one silently (see getProfileByUserId).
//   - Everyone else: draws from the same 5 lifetime free unlocks used
//     across the whole app — one unlock, one profile, forever.
// Once unlocked it never re-locks, even after free credits run out or a
// Premium plan later expires.
export const unlockProfileDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (String(userId) === String(req.user._id)) {
    res.status(400);
    throw new Error("This is your own profile");
  }

  const targetUser = await User.findById(userId).select("_id");
  if (!targetUser) {
    res.status(404);
    throw new Error("Profile not found");
  }

  const respond = (message) =>
    ok(
      res,
      {
        detailsUnlocked: true,
        freeUnlocksRemaining: req.user.freeUnlocksLeft(),
        planUnlocksRemaining: req.user.planUnlocksRemaining(),
      },
      message
    );

  const existing = await ProfileUnlock.findOne({ viewer: req.user._id, unlockedUser: userId });
  if (existing) {
    return respond("Unlocked");
  }

  if (req.user.isPremium()) {
    // Spend one plan credit now, at the moment of confirmed unlock — not
    // when the profile page was merely opened (matches the check already
    // used elsewhere in this codebase for the same quota).
    if (req.user.planUnlockQuota !== null && req.user.planUnlocksUsed < req.user.planUnlockQuota) {
      req.user.planUnlocksUsed += 1;
      await req.user.save();
    }
    await ProfileUnlock.create({ viewer: req.user._id, unlockedUser: userId, method: "premium" });
    return respond(`Unlocked — you have ${req.user.planUnlocksRemaining()} profile unlocks left this plan period`);
  }

  if (req.user.freeUnlocksLeft() > 0) {
    await ProfileUnlock.create({ viewer: req.user._id, unlockedUser: userId, method: "free" });
    req.user.freeUnlocksRemaining = Math.max(0, req.user.freeUnlocksLeft() - 1);
    await req.user.save();
    return respond(`Unlocked — ${req.user.freeUnlocksLeft()} free unlocks remaining`);
  }

  res.status(403);
  throw new Error(
    "You're out of free unlocks. Upgrade to Premium for unlimited access to every profile."
  );
});

// GET /api/profiles/me/visitors
export const getMyVisitors = asyncHandler(async (req, res) => {
  const distinctViewerIds = await ProfileView.distinct("viewer", { viewedUser: req.user._id });
  const totalVisitors = distinctViewerIds.length;

  if (!req.user.isPremium()) {
    return ok(res, { totalVisitors, visitors: [], locked: true });
  }

  const recentViews = await ProfileView.find({ viewedUser: req.user._id })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate({ path: "viewer", select: "fullName isProfileVerified lastActiveAt" })
    .lean();

  const seen = new Set();
  const dedupedViews = [];
  for (const view of recentViews) {
    if (!view.viewer) continue;
    const id = String(view.viewer._id);
    if (seen.has(id)) continue;
    seen.add(id);
    dedupedViews.push(view);
  }

  // Single batched lookup instead of one Profile.findOne per visitor —
  // was up to 30 sequential round-trips to Mongo on this endpoint alone.
  const viewerIds = dedupedViews.map((v) => v.viewer._id);
  const viewerProfiles = await Profile.find({ user: { $in: viewerIds } })
    .select("user photos")
    .lean();
  const photosByUserId = new Map(viewerProfiles.map((p) => [String(p.user), p.photos || []]));

  const visitors = dedupedViews.map((view) => ({
    user: { ...view.viewer, photos: photosByUserId.get(String(view.viewer._id)) || [] },
    viewedAt: view.createdAt,
  }));

  ok(res, { totalVisitors, visitors, locked: false });
});

// POST /api/profiles/:userId/shortlist
export const toggleShortlist = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (String(userId) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot shortlist yourself");
  }

  const existing = await Shortlist.findOne({ user: req.user._id, shortlistedUser: userId });
  if (existing) {
    await existing.deleteOne();
    return ok(res, { shortlisted: false }, "Removed from shortlist");
  }

  await Shortlist.create({ user: req.user._id, shortlistedUser: userId });
  ok(res, { shortlisted: true }, "Added to shortlist", 201);
});

// GET /api/profiles/me/shortlisted
export const getMyShortlist = asyncHandler(async (req, res) => {
  const shortlist = await Shortlist.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  const userIds = shortlist.map((s) => s.shortlistedUser);

  const profiles = await Profile.find({ user: { $in: userIds } })
    .populate("user", "fullName gender isProfileVerified lastActiveAt profileCode")
    .lean();

  ok(res, { total: profiles.length, profiles });
});
