import { Box, Typography } from "@mui/material";
import type { JobDetail, JdStatus, MatchedRule } from "../../api/dto";
import { JD_STATUS_LABEL } from "../../api/dto";
import { typeScale } from "../../theme/tokens";
import { Button } from "../controls/Button";
import { Pill, type PillTone } from "./Pill";
import { Sheet } from "../feedback/Sheet";

export interface JobDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  job: JobDetail | null;
  onDelete?: (jobId: string) => void;
  /** 底部动作区（投递/收藏等） */
  footer?: React.ReactNode;
}

function jdTone(status: JdStatus | string | null | undefined): PillTone {
  if (status === "failed") return "warn";
  if (status === "completed") return "ok";
  return "static";
}

function RuleCard({ rule }: { rule: MatchedRule }) {
  return (
    <Box sx={{ p: 1.5, bgcolor: "surface2", borderRadius: "12px", display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
        <Typography sx={{ ...typeScale.bodySm, fontWeight: 590 }}>
          {rule.rule_type === "company" ? "公司规则" : "JD 关键词"}
        </Typography>
        {rule.match_mode != null && rule.match_mode !== "" && <Pill tone="static">{rule.match_mode}</Pill>}
      </Box>
      <Typography sx={{ ...typeScale.bodySm }}>{rule.pattern}</Typography>
      <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>
        命中内容：{rule.matched_text || "—"}
        {rule.source ? ` · 范围 ${rule.source}` : ""}
      </Typography>
    </Box>
  );
}

/** 职位详情右侧 Sheet（材质化进入；5.3 JobCard/JobDetailDrawer 行）。 */
export function JobDetailDrawer({ open, onClose, job, onDelete, footer }: JobDetailDrawerProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={520}
      title={job?.job_name}
      footer={
        <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between" }}>
          {job != null && onDelete !== undefined && (
            <Button variant="danger" onClick={() => onDelete(job.job_id)}>删除这条</Button>
          )}
          {footer}
        </Box>
      }
    >
      {job != null && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...typeScale.l, fontWeight: 650 }}>{job.brand_name}</Typography>
              <Typography sx={{ ...typeScale.bodySm, color: "text.secondary" }}>
                {[job.location, job.brand_industry].filter(Boolean).join(" · ")}
              </Typography>
            </Box>
            <Typography sx={{ ...typeScale.l, fontWeight: 650, color: "primary.main", whiteSpace: "nowrap" }}>
              {job.salary_desc || "面议"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            <Pill tone="static">{job.job_experience || "—"}</Pill>
            <Pill tone="static">{job.job_degree || "—"}</Pill>
            <Pill tone="static">{job.brand_scale_name || "—"}</Pill>
            {job.company_blacklisted && <Pill tone="warn">公司黑名单</Pill>}
            {job.jd_blacklisted && <Pill tone="warn">JD 关键词黑名单</Pill>}
            <Pill tone={jdTone(job.jd_status)}>
              JD：{JD_STATUS_LABEL[job.jd_status as JdStatus] ?? String(job.jd_status ?? "未知")}
            </Pill>
            {job.jd_rule_checked === false && <Pill tone="warn">JD 规则未检查</Pill>}
          </Box>

          {job.matched_rule_snapshot != null && job.matched_rule_snapshot.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ ...typeScale.s, color: "text.secondary" }}>
                命中规则（{job.matched_rule_snapshot.length} 条）
              </Typography>
              {job.matched_rule_snapshot.map((r, i) => <RuleCard key={i} rule={r} />)}
            </Box>
          )}

          <Box>
            <Typography sx={{ ...typeScale.s, color: "text.secondary", mb: 0.75 }}>技能 / 标签</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {job.skills?.length
                ? job.skills.map((s) => <Pill key={s} tone="accent">{s}</Pill>)
                : <Typography sx={{ ...typeScale.bodySm, color: "text.secondary" }}>—</Typography>}
            </Box>
          </Box>

          <Box>
            <Typography sx={{ ...typeScale.s, color: "text.secondary", mb: 0.75 }}>福利</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {job.welfare_list?.length
                ? job.welfare_list.map((s) => <Pill key={s} tone="static">{s}</Pill>)
                : <Typography sx={{ ...typeScale.bodySm, color: "text.secondary" }}>—</Typography>}
            </Box>
          </Box>

          <Box>
            <Typography sx={{ ...typeScale.s, color: "text.secondary", mb: 0.75 }}>职位描述</Typography>
            {job.job_desc ? (
              /* 职位描述不限高（缺陷清单「岗位详情」）：整段铺开，滚动交给 Sheet 内容区 */
              <Box
                sx={{
                  ...typeScale.bodySm,
                  whiteSpace: "pre-wrap",
                  p: 1.5,
                  bgcolor: "surface2",
                  borderRadius: "12px",
                }}
              >
                {job.job_desc}
              </Box>
            ) : (
              <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>
                搜索列表里不带职位描述；点「补全描述」，或下次搜索时顺带取回。
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ ...typeScale.s, color: "text.secondary", mb: 0.5 }}>Boss</Typography>
            <Typography sx={{ ...typeScale.bodySm }}>
              {job.boss_name || "—"} {job.boss_title ?? ""}
            </Typography>
          </Box>
        </Box>
      )}
    </Sheet>
  );
}
