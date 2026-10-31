/**
 * 分析历史：跑过的匹配归档列表，可载回工作台 / 删除（带确认）。
 *
 * 载入会把结果写回页面级状态并切去工作台；标题固定、列表局部滚动。
 */

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

import { Button, EmptyState, pageRootSx, Pill, ScrollArea, Sheet, Surface, useToast } from "../../../components";
import { typeScale } from "../../../theme/tokens";
import { fmtNumber, fmtTime } from "../../../utils/format";
import { matchApi } from "../../../api/shared";
import {
  analysisStatusLabel, errText, type AnalysisRow,
} from "./types";

/** 分析历史段：归档列表，可载入工作台或删除。 */
export function HistorySection({
  rows, setRows, onLoadAnalysis, onDelete,
}: {
  rows: AnalysisRow[];
  setRows: (fn: (prev: AnalysisRow[]) => AnalysisRow[]) => void;
  /** 载入一份历史分析到工作台（壳层负责写结果状态并切页签）。 */
  onLoadAnalysis: (id: string) => Promise<void>;
  /** 删除后若删的是当前工作台那份，壳层会顺手清结果。 */
  onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /** 首屏拉历史分析列表。 */
  useEffect(() => {
    void (async () => {
      try {
        const data = await matchApi.analyses();
        setRows(() => (data.items ?? []) as unknown as AnalysisRow[]);
      } catch (e) {
        toast.toast(errText(e), "danger");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 载入一份历史分析并提示结果。 */
  const loadAnalysis = async (id: string) => {
    setLoadingId(id);
    try {
      await onLoadAnalysis(id);
      toast.toast("已载入历史分析", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      setLoadingId(null);
    }
  };

  /** 删除一份历史分析并同步壳层。 */
  const removeAnalysis = async (id: string) => {
    try {
      await matchApi.removeAnalysis(id);
      setRows((prev) => prev.filter((r) => r.analysis_id !== id));
      onDelete(id);
      toast.toast("已删除", "ok");
    } catch (e) {
      toast.toast(errText(e), "danger");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <Box sx={pageRootSx}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flex: "0 0 auto" }}>
        <Typography sx={{ ...typeScale.m, fontWeight: 600, flex: 1 }}>历史分析</Typography>
        <Button
          size="small" variant="gray"
          onClick={() => {
            void (async () => {
              try {
                const data = await matchApi.analyses();
                setRows(() => (data.items ?? []) as unknown as AnalysisRow[]);
              } catch (e) {
                toast.toast(errText(e), "danger");
              }
            })();
          }}
        >
          刷新
        </Button>
      </Box>

      <ScrollArea>
        {rows.length === 0 ? (
          <EmptyState title="还没有历史分析" />
        ) : (
          <Box>
            {rows.map((row) => (
              <Surface
                key={row.analysis_id}
                role="group"
                aria-label={`历史分析 ${row.analysis_id}`}
                sx={{ mb: 1.5, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}
              >
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography sx={{ ...typeScale.bodySm, fontWeight: 590 }}>
                    {row.resume_title || row.analysis_id}
                  </Typography>
                  <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>
                    {fmtTime(row.created_at)} · {fmtNumber(row.job_count)} 个职位 · 模型 {row.model || "—"} · {analysisStatusLabel(row.status)}
                  </Typography>
                </Box>
                <Pill tone="accent">最高 {fmtNumber(row.top_score)}</Pill>
                <Button
                  size="small" variant="gray"
                  disabled={loadingId === row.analysis_id}
                  onClick={() => void loadAnalysis(row.analysis_id)}
                >
                  {loadingId === row.analysis_id ? "载入中…" : "载入"}
                </Button>
                <Button size="small" variant="plain" onClick={() => setConfirmDeleteId(row.analysis_id)}>
                  删除
                </Button>
              </Surface>
            ))}
          </Box>
        )}
      </ScrollArea>

      <Sheet
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="删除分析"
        anchor="center"
        width={380}
        footer={
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button variant="gray" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button variant="danger" onClick={() => confirmDeleteId && void removeAnalysis(confirmDeleteId)}>
              确认删除
            </Button>
          </Box>
        }
      >
        <Typography sx={{ ...typeScale.bodySm }}>
          删除这份分析？删除后不可恢复。
        </Typography>
      </Sheet>
    </Box>
  );
}
