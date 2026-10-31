/**
 * 未迁移页面的占位（拍板 #5「legacy 共存逐页切」）。
 *
 * 新壳先把布局/路由/上下文跑通，这页给出通往旧壳对应视图的直达入口；
 * 逐页迁完就删掉这条占位路由，不留死链。
 */

import { Box } from "@mui/material";
import { Button, EmptyState, PageHeader, ScrollArea, Surface, pageRootSx } from "../components";

export interface PendingPageProps {
  title: string;
  /** 旧壳 hash 路径（如 `#/resume`）；不给就只是占位，不出直达按钮 */
  legacyHash?: string;
}

/** 把旧 hash 拼成 `/legacy/#/…` 的完整入口。 */
export function legacyHref(hash: string): string {
  return `/legacy/#${hash.startsWith("/") ? hash : `/${hash}`}`;
}

export function PendingPage({ title, legacyHash }: PendingPageProps) {
  return (
    <Box sx={pageRootSx}>
      <PageHeader title={title} />
      <ScrollArea>
        <Surface sx={{ maxWidth: 560 }}>
          <EmptyState
            icon="◷"
            title="这一页还没迁到新壳"
            action={
              legacyHash ? (
                <Button
                  variant="filled"
                  onClick={() => {
                    window.location.href = legacyHref(legacyHash);
                  }}
                >
                  打开旧界面
                </Button>
              ) : undefined
            }
          />
        </Surface>
      </ScrollArea>
    </Box>
  );
}
