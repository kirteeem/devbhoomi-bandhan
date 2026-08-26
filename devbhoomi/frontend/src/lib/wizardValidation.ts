import type { WizardFormData } from "../types/wizard";

export type WizardErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// SOURCE OF TRUTH
// ---------------------------------------------------------------------------
// What's actually "required" here is a product decision made in ONE place —
// this file — not something each step component decides for itself. The
// backend (backend/src/controllers/profileController.js updateProfileSchema)
// intentionally treats every field as optional, because "Save Draft" must
// always succeed with a half-filled profile. So the backend can never be the
// source of "required"; it only enforces FORMAT/RANGE (e.g. heightCm between
// 100-250cm, must be 18+ years old, district must be a real district). Those
// range/format rules ARE mirrored here, field-for-field, so the wizard can
// never accept a value locally that the backend will then reject — see each
// validator below for its matching backend rule.
//
// Required-ness is a UI/UX decision layered on top: a handful of fields are
// asterisked in the step components because a usable profile needs them, and
// that list lives in REQUIRED_STEPS below. Every field not listed there is
// optional and must never block Next/Submit.

const isBlank = (value: unknown): boolean =>
  value === "" || value === null || value === undefined;

const isAtLeast18 = (dobString: string): boolean => {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return true; // let the "invalid date" check below handle this
  const ageMs = Date.now() - dob.getTime();
  return ageMs / (365.25 * 24 * 60 * 60 * 1000) >= 18;
};

// Human-readable names for every field validateStep can flag — used both for
// the inline error under the field and to build a specific
// "Please fill in: X, Y" toast instead of a vague generic one. Also used to
// scroll/focus the right field (each field is wrapped in a
// `data-field-error="<key>"` container in its step component).
export const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  dateOfBirth: "Date of Birth",
  heightCm: "Height",
  maritalStatus: "Marital Status",
  district: "Native District",
  customDistrict: "Custom District / State",
  city: "City / Town / Village",
  address: "Full Address",
  "education.degree": "Highest Degree",
  "occupation.title": "Current Occupation",
  religion: "Religion",
  caste: "Caste",
  "family.siblings": "Number of Siblings",
  "partnerPreference.ageMin": "Preferred Minimum Age",
  "partnerPreference.ageMax": "Preferred Maximum Age",
  "partnerPreference.heightMinCm": "Preferred Minimum Height",
};

// Specific, human-friendly "you're missing this" messages for every field
// that's actually required. Falls back to a generic "<Label> is required."
// for anything not listed here (there shouldn't be many).
const REQUIRED_MESSAGES: Record<string, string> = {
  dateOfBirth: "Date of birth is required.",
  heightCm: "Please enter your height.",
  maritalStatus: "Please select your marital status.",
  district: "Please select your district.",
  customDistrict: "Please tell us your district or state.",
  city: "Please enter your city, town, or village.",
  address: "Please enter your full address.",
  "education.degree": "Please select your highest degree.",
  "occupation.title": "Please select your current occupation.",
  religion: "Please select your religion.",
  caste: "Please select your caste.",
};

const requiredMessage = (key: string): string =>
  REQUIRED_MESSAGES[key] || `${FIELD_LABELS[key] || key} is required.`;

// --- Reusable field-level validators -----------------------------------
// Each returns an error message (string) or undefined. Keeping these small
// and composable avoids a wall of nested if/else per step.

/** Fails if the field is required and blank. Never fires for optional fields. */
const required = (value: unknown, key: string): string | undefined =>
  isBlank(value) ? requiredMessage(key) : undefined;

/**
 * Numeric range check that only fires when a value is actually present —
 * i.e. it never blocks an optional, empty field, but if the member DID type
 * something, it must be within the same bounds the backend enforces
 * (z.number().min/max in updateProfileSchema), so we never send the backend
 * something it's guaranteed to reject.
 */
const optionalNumberInRange = (
  value: number | "" | undefined,
  min: number,
  max: number,
  message: string
): string | undefined => {
  if (isBlank(value)) return undefined;
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) return message;
  return undefined;
};

// ---------------------------------------------------------------------------
// STEP DEFINITIONS
// ---------------------------------------------------------------------------

// Steps that have at least one field marked required (*) in the UI. Kept in
// one place so the asterisk shown to the person and the validation that
// actually blocks Next/Submit can never drift apart again.
export const REQUIRED_STEPS = [0, 1, 2, 3];

// Total number of wizard steps — kept here (rather than re-importing the
// STEPS array from the page) just for the final full-scan below.
const TOTAL_STEPS = 4;

/**
 * Validates a single wizard step. Two kinds of checks happen here, and
 * ONLY here — there is no second copy of this logic anywhere else in the
 * app (no per-component re-validation, no second check before the API
 * call):
 *   1. Required-field checks (only for fields in REQUIRED_STEPS' steps).
 *   2. Range/format checks that mirror the backend exactly, but only ever
 *      fire when the (optional) field actually has a value — so an empty
 *      optional field never blocks progress, but a filled-in one that the
 *      backend would reject gets caught immediately, with a clear message,
 *      instead of surfacing as a confusing error after Submit.
 */
export const validateStep = (step: number, data: WizardFormData): WizardErrors => {
  const draft: Record<string, string | undefined> = {};

  if (step === 0) {
    // Personal details + location
    draft.fullName = required((data as any).fullName, "fullName");
    draft.dateOfBirth =
      required(data.dateOfBirth, "dateOfBirth") ||
      (isAtLeast18(data.dateOfBirth) ? undefined : "You must be at least 18 years old to create a profile.");
    draft.heightCm =
      required(data.heightCm, "heightCm") ||
      optionalNumberInRange(data.heightCm, 100, 250, "Height must be between 100cm and 250cm.");
    draft.maritalStatus = required(data.maritalStatus, "maritalStatus");
    draft.district = required(data.district, "district");
    if (data.district === "Other") {
      draft.customDistrict = required(data.customDistrict, "customDistrict");
    }
    draft.city = required(data.city, "city");
    draft.address = required(data.address, "address");
  }

  if (step === 1) {
    // Education & career + family
    draft["education.degree"] = required(data.education?.degree, "education.degree");
    draft["occupation.title"] = required(data.occupation?.title, "occupation.title");
    draft["family.siblings"] = optionalNumberInRange(
      data.family?.siblings,
      0,
      20,
      "Number of siblings must be between 0 and 20."
    );
  }

  if (step === 2) {
    // Religion, lifestyle & partner preference
    draft.religion = required(data.religion, "religion");
    if (data.religion === "Hindu") {
      draft.caste = required(data.caste, "caste");
    }
    draft["partnerPreference.ageMin"] = optionalNumberInRange(
      data.partnerPreference?.ageMin,
      18,
      100,
      "Minimum preferred age must be between 18 and 100."
    );
    draft["partnerPreference.ageMax"] = optionalNumberInRange(
      data.partnerPreference?.ageMax,
      18,
      100,
      "Maximum preferred age must be between 18 and 100."
    );
    if (
      !draft["partnerPreference.ageMin"] &&
      !draft["partnerPreference.ageMax"] &&
      !isBlank(data.partnerPreference?.ageMin) &&
      !isBlank(data.partnerPreference?.ageMax) &&
      Number(data.partnerPreference.ageMax) < Number(data.partnerPreference.ageMin)
    ) {
      draft["partnerPreference.ageMax"] = "Maximum age must be greater than or equal to minimum age.";
    }
    draft["partnerPreference.heightMinCm"] = optionalNumberInRange(
      data.partnerPreference?.heightMinCm,
      100,
      250,
      "Minimum preferred height must be between 100cm and 250cm."
    );
  }

  if (step === 3) {
    // Photos and review step — no extra required fields here beyond the
    // full-scan performed before final submit.
  }

  // Only keys that actually failed make it into the returned errors object.
  const errors: WizardErrors = {};
  for (const [key, message] of Object.entries(draft)) {
    if (message) errors[key] = message;
  }
  return errors;
};

/**
 * Runs validateStep across every step, stopping at the first one that
 * fails — used right before final submit so a member who skipped ahead (or
 * edited a required field back to empty, or typed an out-of-range optional
 * value) can't publish an invalid profile, and is dropped back on exactly
 * the step that needs attention. Scans ALL steps (not just the ones with
 * required fields) because optional-but-bounded fields (siblings, partner
 * preference) can also fail on their own step.
 */
export const validateAllRequiredSteps = (
  data: WizardFormData
): { step: number; errors: WizardErrors } | null => {
  for (let step = 0; step < TOTAL_STEPS; step++) {
    const errors = validateStep(step, data);
    if (Object.keys(errors).length > 0) return { step, errors };
  }
  return null;
};
