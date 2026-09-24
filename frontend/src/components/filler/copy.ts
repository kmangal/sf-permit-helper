export function signHint(signed: boolean, pen: boolean): string {
  if (signed) return "Signed by hand.";
  return pen ? "Draw your signature on the line above." : "Turn on the pen to sign this form.";
}
