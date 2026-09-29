// /contact: a feedback form that posts straight to Formspree, which emails it on.

import { useForm, ValidationError } from "@formspree/react";
import styles from "./ContactPage.module.css";

/** The Formspree form id; submissions go to https://formspree.io/f/<id>. */
const FORM_ID = "xoevrdoe";
const REPO = "https://github.com/kmangal/sf-permit-helper";

export function ContactPage() {
  const [state, handleSubmit] = useForm(FORM_ID);

  return (
    <div className={styles.screen}>
      <div className={styles.page}>
        <h1 className={styles.head}>Contact</h1>
        {state.succeeded ? (
          <p className={styles.done} role="status">
            Thanks, your message was sent.
          </p>
        ) : (
          <>
            <p className={styles.sub}>
              Thank you for your interest in the SF Permit Helper! We're always looking to make this system
              work better. If you have any feedback, or would like to help us build, please get in touch!
            </p>
            <p className={styles.sub}>
              This project is open source, and contributions are welcome at{" "}
              <a href={REPO} target="_blank" rel="noreferrer">
                github.com/kmangal/sf-permit-helper
              </a>
              .
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span className={styles.label}>
                  Name <span className={styles.optional}>(optional)</span>
                </span>
                <input className={styles.input} type="text" name="name" autoComplete="name" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input className={styles.input} type="email" name="email" autoComplete="email" required />
                <ValidationError className={styles.error} field="email" prefix="Email" errors={state.errors} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Message</span>
                <textarea className={styles.textarea} name="message" rows={6} required />
                <ValidationError className={styles.error} field="message" prefix="Message" errors={state.errors} />
              </label>
              <ValidationError className={styles.error} errors={state.errors} role="alert" />
              <button type="submit" className={styles.send} disabled={state.submitting}>
                {state.submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
