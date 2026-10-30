import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { JobSummary, JdStatus } from "../../api/dto";
import { JD_STATUS_LABEL } from "../../api/dto";
import { typeScale } from "../../theme/tokens";
import { Pill, type PillTone } from "./Pill";
import { ScoreRing } from "./ScoreRing";
import { Surface } from "../surfaces/Surface";

export interface JobCardProps {
  job: JobSummary;
  onClick?: () => void;
  /** 右侧动作区（收藏/投递等） */
  actions?: ReactNode;
  /** 左侧插槽（勾选框等），与卡片主体同容器（缺陷「checkbox和主体不应该分开两个容器」） */
  leading?: ReactNode;
}

function jdTone(status: JdStatus | string | null | undefined): PillTone {
  if (status === "failed") return "warn";
  if (status === "completed") return "ok";
  return "static";
}

/** 职位卡片（列表行）：公司/标题/薪资 + 右侧分数环。
 *
 * 缺陷「岗位项误触开详情」：卡片不带按压缩放（apple-press）——勾选框和主体同卡，
 * 按压动效会让「点勾选」的手感变成「开详情」；改为悬浮高亮（Surface hoverable）。
 */
export function JobCard({ job, onClick, actions, leading }: JobCardProps) {
  return (
    <Surface padded={false} hoverable={!!onClick} onClick={onClick}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, p: 2 }}>
        {leading !== undefined && (
          /* 前缀插槽里的点击（勾选等）不冒泡去开详情 */
          <Box
            sx={{ display: "flex", alignItems: "center", flex: "0 0 auto", ml: -0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {leading}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ ...typeScale.m, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.brand_name}
          </Typography>
          <Typography sx={{ ...typeScale.bodySm, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.job_name}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
            {job.salary_desc != null && <Pill tone="accent">{job.salary_desc || "面议"}</Pill>}
            {job.location != null && job.location !== "" && <Pill tone="static">{job.location}</Pill>}
            {job.job_experience != null && job.job_experience !== "" && <Pill tone="static">{job.job_experience}</Pill>}
            {job.job_degree != null && job.job_degree !== "" && <Pill tone="static">{job.job_degree}</Pill>}
            {job.jd_status != null && (
              <Pill tone={jdTone(job.jd_status)}>
                JD：{JD_STATUS_LABEL[job.jd_status as JdStatus] ?? String(job.jd_status)}
              </Pill>
            )}
          </Box>
        </Box>
        {job.score != null && <ScoreRing score={job.score} size={52} label="匹配" />}
        {actions}
      </Box>
    </Surface>
  );
}
