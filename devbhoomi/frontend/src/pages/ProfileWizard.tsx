import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Save, Loader2, AlertTriangle } from "lucide-react";
import { fetchMyProfile, updateMyProfile } from "../lib/profileApi";
import { profileToWizardData, profileToPhotos } from "../lib/wizardMapping";
import { validateStep, validateAllRequiredSteps, FIELD_LABELS } from "../lib/wizardValidation";
import { computeLiveCompletion } from "../lib/profileCompletion";
import { useAuth } from "../context/AuthContext";
import type { WizardFormData, ProfilePhoto } from "../types/wizard";
import { emptyWizardData } from "../types/wizard";

import { Step1Personal } from "../components/wizard/steps/Step1Personal";
import { Step2Location } from "../components/wizard/steps/Step2Location";
import { Step3Education } from "../components/wizard/steps/Step3Education";
import { Step4Family } from "../components/wizard/steps/Step4Family";
import { Step5Religion } from "../components/wizard/steps/Step5Religion";
import { Step6Lifestyle } from "../components/wizard/steps/Step6Lifestyle";
import { Step7PartnerPreference } from "../components/wizard/steps/Step7PartnerPreference";
import { Step8Photos } from "../components/wizard/steps/Step8Photos";
import { Step9Review } from "../components/wizard/steps/Step9Review";

const STEPS = [
  { id: 0, title: "Personal & Location" },
  { id: 1, title: "Career & Family" },
  { id: 2, title: "Values & Preferences" },
  { id: 3, title: "Photos & Review" },
];

export const ProfileWizard = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [data, setData] = useState<WizardFormData>(emptyWizardData);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const profile = await fetchMyProfile();
        if (profile) {
          setData(profileToWizardData(profile));
          setPhotos(profileToPhotos(profile));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Also clears any error already shown for a field the moment it's edited,
  // so the required-field message disappears as soon as it's fixed instead
  // of waiting for the next Next/Submit click.
  const update = (patch: Partial<WizardFormData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const changedKeys = Object.keys(patch);
      const next = { ...prev };
      let touched = false;
      for (const key of Object.keys(next)) {
        if (changedKeys.includes(key) || changedKeys.some((k) => key.startsWith(`${k}.`))) {
          delete next[key];
          touched = true;
        }
      }
      return touched ? next : prev;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  // Turns { dateOfBirth: "...", heightCm: "..." } into "Date of Birth, Height"
  // so the person sees exactly which field(s) they missed, not a vague
  // "some field is required" message they then have to hunt for.
  const describeMissingFields = (fieldErrors: Record<string, string>) =>
    Object.keys(fieldErrors)
      .map((key) => FIELD_LABELS[key] || key)
      .join(", ");

  // Every required field is wrapped in a `data-field-error="<key>"`
  // container in its step component. Scrolling straight to the first one
  // (instead of leaving the person to scan a long scrollable step for a
  // small red asterisk) is what actually gets the error read and fixed.
  const scrollToFirstError = (fieldErrors: Record<string, string>) => {
    const firstKey = Object.keys(fieldErrors)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-field-error="${firstKey}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
    });
  };

  // The profile menu, dashboard card, and browse-gate modal all read
  // `user.profileCompletion` straight out of AuthContext. That context is
  // only ever populated once, at login/app-load, so without this, a member
  // could save a fully-complete profile here and still see the old,
  // lower percentage everywhere else until they manually refreshed the
  // whole page. Pushing the server's fresh number into AuthContext the
  // moment a save succeeds keeps every part of the app in sync immediately.
  const syncCompletionToAuth = (completion: number) => {
    if (!user) return;
    updateUser({ ...user, profileCompletion: completion });
  };

  const handleNext = async () => {
    const stepErrors = validateStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      showToast(`Please fill in: ${describeMissingFields(stepErrors)}`);
      scrollToFirstError(stepErrors);
      return;
    }

    if (step === STEPS.length - 1) {
      const invalid = validateAllRequiredSteps(data);
      if (invalid) {
        setErrors(invalid.errors);
        setDirection(-1);
        setStep(invalid.step);
        showToast(
          `"${STEPS[invalid.step].title}" is incomplete — please fill in: ${describeMissingFields(invalid.errors)}`
        );
        // Wait for the step switch above to render before scrolling to the
        // field inside it.
        setTimeout(() => scrollToFirstError(invalid.errors), 150);
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await updateMyProfile(data);
        syncCompletionToAuth(result.profileCompletion);
        const updatedName = result.profile?.user?.fullName || data.fullName;
        if (user && updatedName) {
          updateUser({ ...user, fullName: updatedName, profileCompletion: result.profileCompletion });
        }
        showToast("Portfolio published successfully 🎉");
        setTimeout(() => navigate("/dashboard"), 1200);
      } catch (err: any) {
        showToast(err?.response?.data?.message || "Something went wrong.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setErrors({});
    setDirection(1);
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) {
      setErrors({});
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm z-50">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
      </div>
    );
  }

  const stepProps = { data, update, errors };
  // Real, weighted profile-strength score — matches exactly what the
  // dashboard/menu/browse-gate show, so there's no "Step 9 of 9 = 100%"
  // illusion when a couple of weighted-but-optional fields are still empty.
  const percentageComplete = computeLiveCompletion(data, photos);

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-md flex justify-center items-start sm:items-center pt-4 pb-4 sm:pt-[86px] sm:pb-6 px-2 sm:px-4 overflow-y-auto"
    >
      {/* INJECTING CUSTOM SCROLLBAR CSS OVERRIDES GLOBALLY TO SHOW TRACK */}
      <style>{`
        .force-visible-scrollbar::-webkit-scrollbar {
          width: 6px !important;
          display: block !important;
        }
        .force-visible-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
          border-radius: 4px;
        }
        .force-visible-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1 !important; 
          border-radius: 4px;
        }
        .force-visible-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8 !important;
        }
        /* Firefox doesn't support the -webkit- scrollbar pseudo-elements
           above, so it needs its own properties or the track/thumb never
           show up there at all. */
        .force-visible-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f1f1;
        }
      `}</style>

      <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-zinc-200/80 flex flex-col h-[calc(100vh-2rem)] sm:h-fit sm:max-h-[calc(100vh-120px)] relative">
        
        {/* HEADER TRACK PROGRESS */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-zinc-100 flex items-center justify-between shrink-0 bg-white rounded-t-xl relative">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-zinc-800 truncate">{STEPS[step].title}</h1>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Step {step + 1} of {STEPS.length} · Profile {percentageComplete}% complete
            </p>
          </div>
          
          <button 
            type="button"
            onClick={() => {
              setIsSaving(true);
              updateMyProfile(data).then((result) => {
                syncCompletionToAuth(result.profileCompletion);
                const updatedName = result.profile?.user?.fullName || data.fullName;
                if (user && updatedName) {
                  updateUser({ ...user, fullName: updatedName, profileCompletion: result.profileCompletion });
                }
                showToast("Draft saved securely");
                setIsSaving(false);
              });
            }}
            disabled={isSaving}
            className="shrink-0 text-xs font-bold text-zinc-400 hover:text-sky-600 transition-colors flex items-center gap-1.5"
          >
            <Save size={14} /> <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save Draft"}</span>
          </button>

          {/* BLUE ACCENT SLIDER BAR */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-100">
            <motion.div 
              className="h-full bg-sky-500"
              animate={{ width: `${percentageComplete}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>

        {/* NATIVE SCROLL ENVELOPE STAGE (WITH SCROLLBAR CLASSES APPLIED) */}
        <div data-lenis-prevent className="p-4 sm:p-6 overflow-y-auto grow bg-white force-visible-scrollbar overscroll-contain">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`wizard-slide-${step}`}
              initial={{ opacity: 0, x: direction * 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -8 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              {step === 0 && (
                <div className="space-y-8">
                  <Step1Personal {...stepProps} />
                  <Step2Location {...stepProps} />
                </div>
              )}
              {step === 1 && (
                <div className="space-y-8">
                  <Step3Education {...stepProps} />
                  <Step4Family {...stepProps} />
                </div>
              )}
              {step === 2 && (
                <div className="space-y-8">
                  <Step5Religion {...stepProps} />
                  <Step6Lifestyle {...stepProps} />
                  <Step7PartnerPreference {...stepProps} />
                </div>
              )}
              {step === 3 && (
                <div className="space-y-8">
                  <Step8Photos
                    data={data}
                    updateData={update}
                    existingPhotos={photos as any[]}
                    onPhotosChange={setPhotos as any}
                  />
                  <Step9Review data={data} photos={photos} onEditStep={(s) => setStep(s)} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* SECURE STICKY BOTTOM BUTTON PANEL */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between shrink-0 rounded-b-xl">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-colors py-1.5 px-3 rounded-md hover:bg-zinc-200/50"
            >
              <ChevronLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-1 bg-sky-500 hover:bg-sky-600 text-white py-2 px-5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            {step === STEPS.length - 1 ? (
              isSubmitting ? "Publishing..." : "Publish Profile"
            ) : (
              <>
                Next <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>

      </div>

      {/* SYSTEM TOAST DISPLAY BANNER */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 5, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-sm items-start gap-2.5 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-left text-white shadow-2xl"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <span className="text-sm font-semibold leading-snug">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
