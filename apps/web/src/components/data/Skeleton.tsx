/** 骨架屏：加载占位。 */

import { Skeleton as MuiSkeleton, type SkeletonProps } from "@mui/material";

/** 骨架屏：加载占位（代替旧「正在接入…」文案）。 */
export function Skeleton(props: SkeletonProps) {
  return <MuiSkeleton {...props} />;
}
