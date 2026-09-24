import { useState } from "react";
import type { SectionView } from "../../lib/forms.ts";
import type { Stroke } from "../../lib/ink.ts";
import { signHint } from "./copy.ts";
import styles from "./Paper.module.css";
import { PaperField } from "./PaperField.tsx";
import { PenOverlay } from "./PenOverlay.tsx";

interface Props {
  agency: string;
  title: string;
  reference: string;
  sections: SectionView[];
  /** While on, the page takes ink and fields stop being editable. */
  pen: boolean;
  strokes: Stroke[];
  onStroke: (stroke: Stroke) => void;
  onEdit: (key: string, value: string) => void;
}

/** The form as a sheet of paper: masthead, fields, signature lines, ink. */
export function Paper({ agency, title, reference, sections, pen, strokes, onStroke, onEdit }: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const signed = strokes.length > 0;

  return (
    <div className={styles.desk}>
      <div className={styles.sheet}>
        <div className={styles.page}>
          <div className={styles.masthead}>
            <div>
              <div className={styles.agency}>{agency}</div>
              <div className={styles.title}>{title}</div>
            </div>
            <div className={styles.reference}>{reference}</div>
          </div>

          {sections.map((sec, si) => (
            <fieldset key={si} className={styles.section}>
              <legend className={styles.sectionTitle}>{sec.title}</legend>
              <div className={styles.grid}>
                {sec.fields.map((f) => {
                  const canEdit = f.editable && !pen;
                  return (
                    <PaperField
                      key={f.key}
                      field={f}
                      canEdit={canEdit}
                      editing={canEdit && editingKey === f.key}
                      onStartEdit={() => setEditingKey(f.key)}
                      onChange={(v) => onEdit(f.key, v)}
                      onStopEdit={() => setEditingKey(null)}
                    />
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className={styles.signatures}>
            <div className={styles.signature}>
              <div className={styles.signatureLabel}>Applicant signature</div>
              <div className={styles.signatureLine} />
            </div>
            <div className={styles.signature}>
              <div className={styles.signatureLabel}>Date</div>
              <div className={styles.signatureLine} />
            </div>
          </div>
          <div className={styles.hint} data-signed={signed ? "" : undefined}>
            {signHint(signed, pen)}
          </div>
        </div>
        <PenOverlay strokes={strokes} enabled={pen} onStroke={onStroke} />
      </div>
    </div>
  );
}
