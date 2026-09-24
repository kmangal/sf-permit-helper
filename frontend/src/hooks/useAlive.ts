import { useEffect, useRef } from "react";

/** False once the component unmounts, so async work can stop at its next await. */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
