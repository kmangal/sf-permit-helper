// The one place a component sets `style`: a CSS custom property, `--i`, that
// stylesheets read to stagger entrance animations, e.g.
//   animation-delay: calc(320ms + var(--i) * 110ms);

import type { CSSProperties, ComponentPropsWithoutRef, ElementType } from "react";

type Props<T extends ElementType> = {
  as?: T;
  index: number;
} & Omit<ComponentPropsWithoutRef<T>, "style">;

export function Staggered<T extends ElementType = "div">({ as, index, ...rest }: Props<T>) {
  const Tag: ElementType = as ?? "div";
  return <Tag {...rest} style={{ "--i": index } as CSSProperties} />;
}
