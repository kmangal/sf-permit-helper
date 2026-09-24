import type { FieldView } from "../../lib/forms.ts";
import styles from "./PaperField.module.css";

interface Props {
  field: FieldView;
  /** Clicking a filled value turns it into an input. */
  canEdit: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onChange: (value: string) => void;
  onStopEdit: () => void;
}

/** One labelled line on the paper form. */
export function PaperField({ field, canEdit, editing, onStartEdit, onChange, onStopEdit }: Props) {
  const inputId = "field-" + field.key;
  return (
    <div className={styles.field} data-span={field.span}>
      <label className={styles.label} htmlFor={editing ? inputId : undefined}>
        {field.label}
      </label>
      <div
        className={styles.box}
        data-status={field.status}
        data-editable={canEdit ? "" : undefined}
        data-editing={editing ? "" : undefined}
        onClick={canEdit && !editing ? onStartEdit : undefined}
      >
        {editing ? (
          <input
            id={inputId}
            className={styles.input}
            autoFocus
            value={field.value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") onStopEdit();
            }}
            onBlur={onStopEdit}
          />
        ) : field.status === "filled" ? (
          <div className={styles.value}>{field.value}</div>
        ) : field.status === "waiting" ? (
          <div className={styles.waiting}>waiting on you</div>
        ) : null}
      </div>
    </div>
  );
}
