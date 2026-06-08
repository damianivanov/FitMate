import { LuImage } from "react-icons/lu";

type ImageFileInputProps = {
  id: string;
  fileName?: string | null;
  accept?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onChange: (file: File | null) => void;
};

export function ImageFileInput({
  id,
  fileName,
  accept = "image/*",
  disabled = false,
  placeholder = "Choose an image",
  className,
  onChange,
}: ImageFileInputProps) {
  const dropZoneClassName = [
    "liquid-template-dashed flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm",
    disabled ? "pointer-events-none opacity-60" : "cursor-pointer",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label htmlFor={id} className={dropZoneClassName}>
      <LuImage className="h-5 w-5 shrink-0 text-primary" />
      <span className="truncate text-primary">{fileName || placeholder}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}
