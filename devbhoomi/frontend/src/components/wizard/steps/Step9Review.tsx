import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserRound, 
  GraduationCap, 
  Briefcase, 
  Home, 
  Heart, 
  Camera, 
  BadgeCheck, 
  ShieldCheck, 
  Pencil, 
  Sparkles,
  CheckCircle,
  FileCheck
} from "lucide-react";
import type { WizardFormData, ProfilePhoto } from "../../../types/wizard";
import { StepHeader } from "./StepHeader";
import { resolvePhotoUrl } from "../../../lib/media";

interface Props {
  data: WizardFormData;
  photos: ProfilePhoto[];
  onEditStep: (stepId: number) => void;
}

// Component supporting an optional inline icon indicator
const ReviewRow = ({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string; 
  value?: string | number | null; 
  icon?: any 
}) => (
  <div className="flex items-center justify-between border-b border-[#ECE8E2]/60 py-3 text-xs last:border-0 hover:bg-[#FAF8F5]/40 transition-colors px-1 rounded-sm">
    <span className="text-neutral-400 font-medium tracking-tight flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-neutral-400/80" />}
      {label}
    </span>
    <span className="font-semibold text-[#1A1A1A] text-right max-w-[65%] truncate tracking-tight">{value || "—"}</span>
  </div>
);

const ReviewSection = ({ 
  title, 
  icon: Icon, 
  stepId, 
  onEdit, 
  children 
}: { 
  title: string; 
  icon: any; 
  stepId: number; 
  onEdit: (id: number) => void; 
  children: React.ReactNode 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-20px" }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    className="rounded-xl border border-[#ECE8E2] bg-white p-5 transition-shadow duration-300 hover:shadow-[0_8px_24px_rgba(26,26,26,0.02)]"
  >
    <div className="mb-3.5 flex items-center justify-between border-b border-[#ECE8E2]/40 pb-2.5">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#7B1E3D]/5 text-[#7B1E3D]">
          <Icon size={14} />
        </div>
        <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h4>
      </div>
      <button 
        type="button" 
        onClick={() => onEdit(stepId)} 
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold text-[#7B1E3D] transition-colors hover:bg-[#7B1E3D]/5"
      >
        <Pencil size={11} /> Edit
      </button>
    </div>
    <div className="space-y-0.5">{children}</div>
  </motion.div>
);

export const Step9Review = ({ data, photos, onEditStep }: Props) => {
  const [agreedAccuracy, setAgreedAccuracy] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const profilePhoto = photos.find((p) => p.isProfilePhoto) ?? photos[0];
  const calculatedAge = data.dateOfBirth ? 
    new Date().getFullYear() - new Date(data.dateOfBirth).getFullYear() : "—";

  return (
    <div className="bg-[#FAF8F5] px-1 font-sans text-[#1A1A1A] antialiased">
      
      {/* HEADER SEGMENT */}
      <div className="mb-6 border-b border-[#ECE8E2] pb-5">
        <StepHeader 
          title="Review Your Profile" 
          subtitle="Take one last look at your verified attributes before finalizing your match publication." 
        />
        
        {/* DISCRETE HORIZONTAL PROGRESS CHIPS */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-neutral-400">
          {["Personal & Location", "Career & Family", "Values & Preferences", "Photos & Review"].map((step, idx) => (
            <div key={`step-chip-${idx}`} className="flex items-center gap-1.5">
              <span className="text-[#2E6F57] bg-[#2E6F57]/5 px-2 py-0.5 rounded-md border border-[#2E6F57]/10 font-mono">
                {idx + 1}. {step} ✓
              </span>
              {idx < 3 && <span className="text-neutral-300 font-light">•</span>}
            </div>
          ))}
        </div>
      </div>

      {/* DUAL-COLUMN WORKSPACE GRID */}
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        
        {/* CORE DATA DISPLAY PANEL (70%) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            
            <ReviewSection title="Personal Information" icon={UserRound} stepId={0} onEdit={onEditStep}>
              <ReviewRow label="Full Name" value={(data as any).fullName || "—"} />
              <ReviewRow label="Date of Birth" value={data.dateOfBirth} />
              <ReviewRow label="Age" value={data.dateOfBirth ? `${calculatedAge} Years` : "—"} />
              <ReviewRow label="Height" value={data.heightCm ? `${data.heightCm} cm` : "—"} />
              <ReviewRow label="Marital Status" value={data.maritalStatus?.replace(/_/g, " ")} />
              <ReviewRow label="Mother Tongue" value="Hindi / Himachali" />
            </ReviewSection>

            <ReviewSection title="Location" icon={Home} stepId={1} onEdit={onEditStep}>
              <ReviewRow label="District" value={data.district === "Other" ? data.customDistrict : data.district} />
              <ReviewRow label="City / Village" value={data.city} />
              <ReviewRow label="Address" value={data.address} />
              <ReviewRow label="State" value="Himachal Pradesh" />
              <ReviewRow label="Country" value={data.currentResidenceCountry || "India"} />
            </ReviewSection>

            <ReviewSection title="Education & Career" icon={GraduationCap} stepId={2} onEdit={onEditStep}>
              <ReviewRow label="Highest Qualification" value={data.education?.degree} icon={GraduationCap} />
              <ReviewRow label="Occupation" value={data.occupation?.title} icon={Briefcase} />
              <ReviewRow label="Company Name" value={data.occupation?.company} />
              <ReviewRow label="Annual Income" value={data.occupation?.annualIncomeRange} />
            </ReviewSection>

            <ReviewSection title="Family Details" icon={Home} stepId={1} onEdit={onEditStep}>
              <ReviewRow label="Family Type" value={data.family?.familyType} />
              <ReviewRow label="Family Values" value={data.family?.familyValues} />
              <ReviewRow label="Siblings" value={data.family?.siblings} />
              <ReviewRow label="Origin Context" value="Traditional / Clean Background" />
            </ReviewSection>

            <ReviewSection title="Religion & Horoscope" icon={Sparkles} stepId={2} onEdit={onEditStep}>
              <ReviewRow label="Religion" value={data.religion || "Hindu"} />
              <ReviewRow label="Caste / Gotra" value={data.caste} />
              <ReviewRow label="Rashi" value={data.horoscope?.rashi} />
              <ReviewRow label="Manglik Status" value={data.manglik?.replace(/_/g, " ")} />
            </ReviewSection>

            <ReviewSection title="Lifestyle" icon={Heart} stepId={2} onEdit={onEditStep}>
              <ReviewRow label="Dietary Preference" value={data.lifestyle?.diet?.replace(/_/g, " ")} />
              <ReviewRow label="Smoking" value={data.lifestyle?.drinking} />
              <ReviewRow label="Drinking" value={data.lifestyle?.drinking} />
              <ReviewRow label="Interests" value={data.interests?.join(", ")} />
            </ReviewSection>
          </div>

          <ReviewSection title="Partner Preferences" icon={Heart} stepId={2} onEdit={onEditStep}>
            <div className="grid gap-x-6 sm:grid-cols-2">
              <ReviewRow label="Preferred Age" value={data.partnerPreference?.ageMin && data.partnerPreference?.ageMax ? `${data.partnerPreference?.ageMin}–${data.partnerPreference?.ageMax} Yrs` : "Open"} />
              <ReviewRow label="Preferred Height" value={data.partnerPreference?.heightMinCm ? `From ${data.partnerPreference?.heightMinCm} cm` : "Open"} />
              <ReviewRow label="Preferred Districts" value={data.partnerPreference?.districts?.join(", ") || "All Districts"} />
              <ReviewRow label="Preferred Education" value={data.education?.degree || "Open"} icon={GraduationCap} />
            </div>
          </ReviewSection>

          {/* PHOTO MEDIA GALLERY */}
          <ReviewSection title="Uploaded Media Gallery" icon={Camera} stepId={3} onEdit={onEditStep}>
            <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-neutral-400">
              <span>Attached Items: <strong className="font-mono text-neutral-700">{photos.length}</strong></span>
              <span>Visibility: <strong className="text-[#7B1E3D] uppercase tracking-wide">{data.visibility?.replace(/_/g, " ")}</strong></span>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-4 gap-2.5">
                {photos.map((img, index) => (
                  <div key={`review-photo-node-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-[#ECE8E2] bg-white">
                    <img
                      src={resolvePhotoUrl(img.url) ?? ""}
                      alt="Review Thumbnail"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback in case of broken references
                        e.currentTarget.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150";
                      }}
                    />
                    {img.isProfilePhoto && (
                      <span className="absolute bottom-1 left-1 rounded bg-[#7B1E3D] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#ECE8E2] py-6 text-center text-xs text-neutral-400">
                No supplementary pictures attached.
              </div>
            )}
          </ReviewSection>

          {/* PROFILE BIO STATEMENT */}
          {data.aboutMe && (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="rounded-xl border border-[#ECE8E2] bg-white p-5"
            >
              <div className="mb-2.5 flex items-center justify-between border-b border-[#ECE8E2]/40 pb-2">
                <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-neutral-500">Personal Statement</h4>
                <button type="button" onClick={() => onEditStep(0)} className="text-[11px] font-bold text-[#7B1E3D] hover:underline">Edit</button>
              </div>
              <p className="text-xs leading-relaxed text-neutral-600 whitespace-pre-wrap font-normal tracking-tight">{data.aboutMe}</p>
            </motion.div>
          )}
        </div>

        {/* STICKY RIGHT SIDEBAR */}
        <div className="lg:col-span-1 space-y-5 lg:sticky lg:top-6">
          
          <div className="overflow-hidden rounded-xl border border-[#ECE8E2] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
            <div className="relative mb-3.5 aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-50 border border-[#ECE8E2]">
              {profilePhoto ? (
                <img
                  src={resolvePhotoUrl(profilePhoto.url) ?? ""}
                  alt="Primary Live Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-50 text-neutral-300">
                  <UserRound size={28} strokeWidth={1} />
                </div>
              )}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#2E6F57] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm font-mono">
                <BadgeCheck size={10} /> 100% Complete
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <h3 className="font-sans text-sm font-bold text-[#1A1A1A]">Verified Matrimonial Card</h3>
                <CheckCircle size={13} className="text-[#2E6F57] fill-[#2E6F57] stroke-white" />
              </div>
              <p className="text-xs text-neutral-400 font-medium tracking-tight">
                {calculatedAge} Yrs • {data.heightCm || "—"} cm • {data.district || "Himachal"}
              </p>
            </div>

            <hr className="my-3 border-[#ECE8E2]" />

            <div className="space-y-1.5 text-[10px] font-bold tracking-tight text-neutral-500 uppercase">
              <div className="flex items-center gap-1.5 text-[#2E6F57]">
                <ShieldCheck size={13} /> Active Phone Communication Link
              </div>
              <div className="flex items-center gap-1.5 text-[#2E6F57]">
                <ShieldCheck size={13} /> Secure Identity Dossier Logged
              </div>
            </div>
          </div>

          {/* CONSENTS CARD SYSTEM */}
          <div className="rounded-xl border border-[#ECE8E2] bg-white p-4 space-y-3.5">
            <h4 className="font-sans text-[10px] font-bold uppercase tracking-wider text-neutral-400">Verifications & Consents</h4>
            
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 text-xs text-neutral-600 select-none cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={agreedAccuracy}
                  onChange={(e) => setAgreedAccuracy(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-[#7B1E3D] focus:ring-[#7B1E3D]" 
                />
                <span className="leading-tight group-hover:text-black tracking-tight text-[11px]">I confirm all information provided is completely accurate.</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-neutral-600 select-none cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-[#7B1E3D] focus:ring-[#7B1E3D]" 
                />
                <span className="leading-tight group-hover:text-black tracking-tight text-[11px]">I agree to the platform Terms & Conditions.</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-neutral-600 select-none cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-[#7B1E3D] focus:ring-[#7B1E3D]" 
                />
                <span className="leading-tight group-hover:text-black tracking-tight text-[11px]">I agree to the privacy processing policy.</span>
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* RENDER SUCCESS CONFIRMATION MODAL */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
              className="relative w-full max-w-sm rounded-xl border border-[#ECE8E2] bg-white p-5 text-center shadow-xl z-10"
            >
              <div className="mx-auto mb-3.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#2E6F57]/10 text-[#2E6F57]">
                <FileCheck size={20} />
              </div>
              <h3 className="font-sans text-base font-bold text-[#1A1A1A]">🎉 Congratulations!</h3>
              <p className="mt-1.5 text-xs text-neutral-500 leading-relaxed">
                Your profile has been successfully verified and published to live discovery tracks.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
