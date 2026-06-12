import type { SkillField } from "@shared/types";

export const allowedSkillFields = ["tone", "structure", "styleRules", "constraints", "examples"] as const satisfies readonly SkillField[];

const fieldLabels: Record<SkillField, string> = {
  tone: "Tone",
  structure: "Structure",
  styleRules: "Style rules",
  constraints: "Constraints",
  examples: "Examples"
};

type FieldPickerProps = {
  disabled?: boolean;
  onChange: (fields: SkillField[]) => void;
  value: SkillField[];
};

export function FieldPicker({ disabled = false, onChange, value }: FieldPickerProps) {
  function toggleField(field: SkillField) {
    if (value.includes(field)) {
      onChange(value.filter((currentField) => currentField !== field));
      return;
    }

    onChange([...value, field]);
  }

  return (
    <div className="tag-row" aria-label="Selected fields">
      {allowedSkillFields.map((field) => (
        <label className="tag" key={field}>
          <input checked={value.includes(field)} disabled={disabled} type="checkbox" onChange={() => toggleField(field)} />
          {fieldLabels[field]}
        </label>
      ))}
    </div>
  );
}
