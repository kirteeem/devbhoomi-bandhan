import type { WizardFormData, ProfilePhoto } from "../types/wizard";
import { emptyWizardData } from "../types/wizard";

/** Merges whatever the backend profile document has into the wizard's full shape, so partial/legacy profiles never crash the form. */
export const profileToWizardData = (profile: any): WizardFormData => ({
  fullName: profile?.user?.fullName ?? "",
  dateOfBirth: profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : "",
  heightCm: profile?.heightCm ?? "",
  maritalStatus: profile?.maritalStatus ?? "",
  manglik: profile?.manglik ?? "dont_know",
  aboutMe: profile?.aboutMe ?? "",
  district: profile?.district ?? "",
  customDistrict: profile?.customDistrict ?? "",
  tehsil: profile?.tehsil ?? "",
  village: profile?.village ?? "",
  city: profile?.city ?? "",
  address: profile?.address ?? "",
  currentResidenceCountry: profile?.currentResidenceCountry ?? "India",
  education: { ...emptyWizardData.education, ...(profile?.education ?? {}) },
  occupation: { ...emptyWizardData.occupation, ...(profile?.occupation ?? {}) },
  family: { ...emptyWizardData.family, ...(profile?.family ?? {}) },
  religion: profile?.religion ?? "Hindu",
  caste: profile?.caste ?? "",
  subCaste: profile?.subCaste ?? "",
  gotra: profile?.gotra ?? "",
  horoscope: { ...emptyWizardData.horoscope, ...(profile?.horoscope ?? {}) },
  lifestyle: { ...emptyWizardData.lifestyle, ...(profile?.lifestyle ?? {}) },
  interests: profile?.interests ?? [],
  partnerPreference: { ...emptyWizardData.partnerPreference, ...(profile?.partnerPreference ?? {}) },
  photos: profile?.photos ?? [],
  visibility: profile?.visibility ?? "members_only",
});

export const profileToPhotos = (profile: any): ProfilePhoto[] => profile?.photos ?? [];
