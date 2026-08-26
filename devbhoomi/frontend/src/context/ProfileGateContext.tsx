import { createContext, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { useAuth } from "./AuthContext";

interface ProfileGateContextValue {
  /** true if the viewer's own profile is at least 50% complete */
  isBrowsingAllowed: boolean;
  /** Call before navigating to a profile / matches list. Returns true if navigation should proceed. */
  guardBrowse: () => boolean;
}

const ProfileGateContext = createContext<ProfileGateContextValue | undefined>(undefined);

export const ProfileGateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const completion = user?.profileCompletion ?? 0;
  // Photos are optional (a default avatar is shown when missing), so
  // browsing only requires a half-complete profile — not 100%.
  const isBrowsingAllowed = !user || completion >= 50;

  const guardBrowse = () => {
    if (isBrowsingAllowed) return true;
    setShowModal(true);
    return false;
  };

  return (
    <ProfileGateContext.Provider value={{ isBrowsingAllowed, guardBrowse }}>
      {children}
      <CompleteProfileModal open={showModal} onClose={() => setShowModal(false)} completion={completion} />
    </ProfileGateContext.Provider>
  );
};

export const useProfileGate = () => {
  const ctx = useContext(ProfileGateContext);
  if (!ctx) throw new Error("useProfileGate must be used within ProfileGateProvider");
  return ctx;
};

const CompleteProfileModal = ({
  open,
  onClose,
  completion,
}: {
  open: boolean;
  onClose: () => void;
  completion: number;
}) => {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[20px] bg-white p-7 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <X size={18} />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7B1E3D]/10 text-[#7B1E3D]">
          <ShieldAlert size={24} />
        </div>

        <h3 className="mt-4 font-display text-lg font-bold text-[#1A1A1A]">
          Complete Your Profile to Browse
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500">
          You need at least an <span className="font-semibold text-[#1A1A1A]">50% complete profile</span> before you
          can browse other members. You can see profile after completing 50%.
        </p>

        <div className="mt-4 rounded-xl bg-[#FAF8F5] p-4">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
            <span>Profile Completion</span>
            <span className="text-[#7B1E3D]">{completion}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-[#7B1E3D] transition-all"
              style={{ width: `${Math.min(100, completion)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] font-medium text-neutral-500">
            {Math.max(0, 50 - completion)}% more to go before you can browse.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#ECE8E2] bg-white py-2.5 text-xs font-semibold text-neutral-600 hover:bg-[#FAF8F5]"
          >
            Not Now
          </button>
          <button
            onClick={() => {
              onClose();
              navigate("/profile/create");
            }}
            className="flex-1 rounded-xl bg-[#7B1E3D] py-2.5 text-xs font-semibold text-white hover:bg-[#631831]"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>
  );
};
