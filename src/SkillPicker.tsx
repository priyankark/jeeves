import type { SkillSummary } from "../shared/automation";
export function SkillPicker({
  skills,
  selected,
  inherited = [],
  onChange,
  disabled = false,
}: {
  skills: SkillSummary[];
  selected: string[];
  inherited?: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const missing = selected.filter((id) => !skills.some((s) => s.id === id));
  return (
    <div className="skill-picker">
      {!skills.length && !missing.length && (
        <p className="field-note">
          Install skills from the Skills marketplace to use them here.
        </p>
      )}
      {skills.map((skill) => (
        <label className="skill-check" key={skill.id}>
          <input
            type="checkbox"
            disabled={disabled || inherited.includes(skill.id)}
            checked={
              selected.includes(skill.id) || inherited.includes(skill.id)
            }
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, skill.id]
                  : selected.filter((id) => id !== skill.id),
              )
            }
          />
          <span>
            <strong>{skill.name}</strong>
            <small>
              {inherited.includes(skill.id)
                ? "Inherited from workflow"
                : `${skill.repo} · ${skill.commit.slice(0, 7)}`}
            </small>
          </span>
        </label>
      ))}
      {missing.map((id) => (
        <label className="skill-check missing" key={id}>
          <input
            type="checkbox"
            disabled={disabled}
            checked
            onChange={() => onChange(selected.filter((s) => s !== id))}
          />
          <span>
            Missing skill<small>{id} · uncheck to remove</small>
          </span>
        </label>
      ))}
    </div>
  );
}
