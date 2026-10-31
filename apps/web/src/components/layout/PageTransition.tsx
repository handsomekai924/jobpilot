/** 页面过渡：进页淡入 + 轻微上浮，出场即换页不等动画。 */

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocation } from "react-router-dom";

import { springs } from "../../theme/tokens";

/** 过渡层同时是布局层：撑满内容区，页面根才能按「整页固定 + 内部滚动」占满视口。 */
const FILL: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
};

/**
 * 页面过渡：进页淡入 + 轻微上浮，像 Element Plus `transition` 那样柔和。
 * 不做排队出场（换页不等动画，响应即时），reduced-motion 退化成短淡入。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      style={FILL}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0.15 } : springs.ui}
    >
      {children}
    </motion.div>
  );
}
