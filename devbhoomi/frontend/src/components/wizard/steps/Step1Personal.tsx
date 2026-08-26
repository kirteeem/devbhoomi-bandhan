import type { WizardFormData } from "../../../types/wizard";
import { TextField } from "../fields/TextField";
import { TextAreaField } from "../fields/TextAreaField";
import { RadioPillGroup } from "../fields/RadioPillGroup";
import { useAuth } from "../../../context/AuthContext";

interface Props {
  data: WizardFormData;
  update: (patch: Partial<WizardFormData>) => void;
  errors: Record<string, string>;
}

const calculateAge = (dobString: string): number | null => {
  if (!dobString) return null;
  const birthDate = new Date(dobString);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const Step1Personal = ({ data, update, errors }: Props) => {
  const calculatedAge = calculateAge(data.dateOfBirth);
  const { user } = useAuth();

  return (
    <div className="space-y-6 w-full text-[#1A1A1A] pr-1">
      
      {/* 0. PROFILE NAME */}
      <div className="space-y-1.5">
        <TextField
          label="Full Name"
          type="text"
          required
          value={data.fullName || user?.fullName || ""}
          error={errors.fullName}
          onChange={(e) => update({ fullName: e.target.value })}
        />
        <p className="text-[11px] text-zinc-400 font-medium pl-1">
          This name will be shown across your profile and account.
        </p>
      </div>

      {/* 1. REGISTERED PHONE */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-400 tracking-wide uppercase">Registered Mobile Number</label>
        <div className="w-full p-2.5 text-sm bg-[#FAF8F5] border border-[#ECE8E2] rounded-xl text-zinc-500 font-bold flex justify-between items-center">
          <span>{user?.phone || "—"}</span>
          <span className="text-[11px] text-[#2E6F57] font-semibold">
            {user?.isPhoneVerified ? "Verified at signup" : "Locked to account"}
          </span>
        </div>
      </div>

      {/* 2. DATE OF BIRTH */}
      <div data-field-error="dateOfBirth" className="space-y-1.5">
        <TextField
          label="Date of Birth" 
          type="date" 
          required
          value={data.dateOfBirth} 
          error={errors.dateOfBirth}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => update({ dateOfBirth: e.target.value })}
        />
        {calculatedAge !== null && !errors.dateOfBirth && (
          <p className="text-xs font-bold text-[#2E6F57] pl-1 mt-1">
            Age: {calculatedAge} Years Old
          </p>
        )}
      </div>

      {/* 3. HEIGHT */}
      <div data-field-error="heightCm" className="space-y-1.5">
        <TextField
          label="Height (cm)" 
          type="number" 
          required
          placeholder="e.g. 172" 
          value={data.heightCm} 
          error={errors.heightCm}
          onChange={(e) => update({ heightCm: e.target.value === "" ? "" : Number(e.target.value) })}
        />
        {data.heightCm && (
          <p className="text-xs font-bold text-zinc-500 pl-1 mt-1">
            Metric: {Math.floor(Number(data.heightCm) / 30.48)}&apos;{Math.round((Number(data.heightCm) % 30.48) / 2.54)}&quot;
          </p>
        )}
      </div>

      {/* 4. MANGLIK STATUS */}
      <div className="space-y-1.5">
        <RadioPillGroup
          label="Manglik Dosha" 
          value={data.manglik}
          onChange={(v) => update({ manglik: v as WizardFormData["manglik"] })}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "dont_know", label: "Don't Know" },
          ]}
        />
      </div>

      {/* 5. MARITAL STATUS */}
      <div data-field-error="maritalStatus" className="space-y-1.5">
        <RadioPillGroup
          label="Marital Status" 
          required 
          error={errors.maritalStatus}
          value={data.maritalStatus}
          onChange={(v) => update({ maritalStatus: v as WizardFormData["maritalStatus"] })}
          options={[
            { value: "never_married", label: "Never Married" },
            { value: "divorced", label: "Divorced" },
            { value: "widowed", label: "Widowed" },
            { value: "awaiting_divorce", label: "Awaiting Divorce" },
          ]}
        />
      </div>

      {/* 6. BIOGRAPHY STATEMENT */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-600 tracking-wide uppercase">Personal Biography Statement</label>
          <span className="text-xs font-mono font-semibold text-zinc-400">
            {(data.aboutMe || "").length} / 1500
          </span>
        </div>
        <TextAreaField
          label="Express your story & personal ethos" 
          rows={4} 
          maxLength={1500}
          placeholder="Share your primary personal values, cultural worldview, career trajectory details, and a brief summary of your perfect companion..."
          value={data.aboutMe || ""} 
          onChange={(e) => update({ aboutMe: e.target.value })}
        />
      </div>

    </div>
  );
};
