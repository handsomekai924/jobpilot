/**
 * 未迁移页面的占位。
 *
 * 平台描述符声明的 `nav_extras` 若还没有对应组件，就落到这里。
 */

import { Box } from "@mui/material";
import { EmptyState, PageHeader, ScrollArea, Surface, pageRootSx } from "@/components";

/** 未迁移占位页的参数。 */
export interface PendingPageProps {
  title: string;
}

/** 未迁移页面占位。 */
export function PendingPage({ title }: PendingPageProps) {
  return (
    <Box sx={pageRootSx}>
      <PageHeader title={title} />
      <ScrollArea>
        <Surface sx={{ maxWidth: 560 }}>
          <EmptyState icon="◷" title="这一页还没迁到新壳" />
        </Surface>
      </ScrollArea>
    </Box>
  );
}
