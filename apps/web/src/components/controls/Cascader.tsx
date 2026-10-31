/** 级联选择（城市单选 / 行业多选）：列式下钻，父级导航、叶子取值。 */

import { useRef, useState } from "react";
import { Box, Popover, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { typeScale } from "@/theme/tokens";
import { mergeSx } from "@/theme/sx";
import { Button } from "@/components/controls/Button";

/** 级联树节点：带子级只导航，叶子即取值。 */
export interface CascaderNode {
  code: string;
  name: string;
  children?: CascaderNode[];
}

/** 级联选择属性：单选传 string，多选传 string[]。 */
export interface CascaderProps {
  nodes: CascaderNode[];
  /** 单选传 string；多选传 string[] */
  value?: string | string[];
  multiple?: boolean;
  onChange: (value: string | string[] | "") => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

/** 深度优先遍历整棵树。 */
function eachNode(nodes: CascaderNode[], fn: (n: CascaderNode) => void): void {
  for (const n of nodes) {
    fn(n);
    if (n.children?.length) eachNode(n.children, fn);
  }
}

/** 按 code 深度优先查找节点；未命中回 null。 */
function findNode(nodes: CascaderNode[], code: string): CascaderNode | null {
  for (const n of nodes) {
    if (n.code === code) return n;
    const hit = n.children?.length ? findNode(n.children, code) : null;
    if (hit) return hit;
  }
  return null;
}

/**
 * 级联选择：列式下钻；单选叶子即取值，多选叶子勾选、「确定」提交。
 * 收起时鼠标不保留焦点、Esc 保留焦点（详见 notes）。
 */
export function Cascader({
  nodes, value, multiple = false, onChange, placeholder = "不限", label, disabled = false, sx,
}: CascaderProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  /** 下钻路径：drill[i] 的 children 是第 i+1 列 */
  const [drill, setDrill] = useState<CascaderNode[]>([]);
  /** 多选草稿（确定才提交） */
  const [draft, setDraft] = useState<string[]>([]);

  const selectedCodes: string[] = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : value ? [value as string] : [];

  const open = anchor != null;

  /** 收起：Esc 键盘保留焦点；鼠标（选中/按钮/点外面）失焦，蓝框不留。 */
  function close(keyboard = false) {
    if (keyboard) triggerRef.current?.focus();
    else triggerRef.current?.blur();
    setAnchor(null);
  }

  /** 触发器上显示的已选摘要：≤2 项列全名，否则「首项 等 N 项」。 */
  function summary(): string {
    if (multiple) {
      const names: string[] = [];
      eachNode(nodes, (n) => {
        if (selectedCodes.includes(n.code)) names.push(n.name);
      });
      if (names.length === 0) return placeholder;
      return names.length <= 2 ? names.join("、") : `${names[0]} 等 ${names.length} 项`;
    }
    const hit = selectedCodes[0] ? findNode(nodes, selectedCodes[0]) : null;
    return hit ? hit.name : selectedCodes[0] || placeholder;
  }

  /** 按当前下钻路径拼出各列节点。 */
  function columns(): CascaderNode[][] {
    const cols: CascaderNode[][] = [nodes];
    for (const node of drill) {
      if (!node.children?.length) break;
      cols.push(node.children);
    }
    return cols;
  }

  /** 展开弹层；单选时下钻到当前值所在分支。 */
  function openAt(e: React.MouseEvent<HTMLElement>) {
    setDraft(selectedCodes);
    const code = selectedCodes[0];
    const hit = code ? findNode(nodes, code) : null;
    if (hit && !hit.children?.length) {
      const path: CascaderNode[] = [];
      /** 递归收集命中节点的祖先路径。 */
      const walk = (list: CascaderNode[], trail: CascaderNode[]): boolean =>
        list.some((n) => {
          if (n.code === hit.code) {
            path.push(...trail);
            return true;
          }
          return n.children?.length ? walk(n.children, [...trail, n]) : false;
        });
      walk(nodes, []);
      setDrill(path);
    } else {
      setDrill([]);
    }
    setAnchor(e.currentTarget);
  }

  const cols = open ? columns() : [];
  const empty = selectedCodes.length === 0;

  return (
    <Box sx={mergeSx({ display: "flex", flexDirection: "column", gap: 0.5 }, sx)}>
      {label !== undefined && (
        <Typography sx={{ ...typeScale.xs, color: "text.secondary" }}>{label}</Typography>
      )}
      <Box
        component="button"
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openAt}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minWidth: 140,
          height: 36,
          px: 1.5,
          border: "1px solid transparent",
          borderColor: open ? "primary.main" : "transparent",
          borderRadius: "12px",
          bgcolor: "surface2",
          color: empty ? "text.disabled" : "text.primary",
          ...typeScale.bodySm,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color 120ms ease",
          "&:focus": { outline: "none" },
          "&:focus-visible": { borderColor: "primary.main" },
          "&::after": { content: '"▾"', color: "text.secondary", fontSize: 11 },
        }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {summary()}
        </Box>
      </Box>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={(_event, reason) => close(reason === "escapeKeyDown")}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          root: { disableRestoreFocus: true },
          paper: {
            sx: {
              mt: 1,
              borderRadius: "16px",
              border: "1px solid",
              borderColor: "divider",
              maxWidth: "92vw",
            },
          },
        }}
      >
        <Box sx={{ display: "flex", minWidth: 160 }}>
          {nodes.length === 0 && (
            <Typography sx={{ ...typeScale.bodySm, color: "text.secondary", px: 2, py: 1.5 }}>
              暂无选项
            </Typography>
          )}
          {cols.map((list, i) => (
            <Box
              key={i}
              sx={{
                minWidth: 160,
                maxHeight: 180,
                overflowY: "auto",
                borderRight: i < cols.length - 1 ? "1px solid" : 0,
                borderColor: "divider",
              }}
            >
              {list.map((n) => {
                const hasKids = Boolean(n.children?.length);
                const isActive = drill[i]?.code === n.code;
                const picked = multiple ? draft.includes(n.code) : selectedCodes.includes(n.code);
                return (
                  <Box
                    key={n.code}
                    component="button"
                    type="button"
                    role="option"
                    aria-selected={picked}
                    onClick={() => {
                      if (hasKids) {
                        setDrill((d) => [...d.slice(0, i), n]);
                        return;
                      }
                      if (multiple) {
                        setDraft((d) => (d.includes(n.code) ? d.filter((c) => c !== n.code) : [...d, n.code]));
                      } else {
                        onChange(n.code);
                        close();
                      }
                    }}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      width: "100%",
                      px: 1.5,
                      py: 1,
                      border: 0,
                      background: isActive ? (t: Theme) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)") : "transparent",
                      color: picked ? "primary.main" : "text.primary",
                      fontWeight: picked ? 590 : 400,
                      ...typeScale.bodySm,
                      textAlign: "left",
                      cursor: "pointer",
                      "&:hover": { bgcolor: (t: Theme) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)") },
                    }}
                  >
                    {multiple && !hasKids && (
                      <Box
                        component="span"
                        aria-hidden
                        sx={{
                          width: 16, height: 16, borderRadius: "5px", flex: "0 0 auto",
                          border: "1.5px solid",
                          borderColor: picked ? "primary.main" : "divider",
                          bgcolor: picked ? "primary.main" : "transparent",
                          color: "#fff",
                          fontSize: 11,
                          lineHeight: "15px",
                          textAlign: "center",
                        }}
                      >
                        {picked ? "✓" : ""}
                      </Box>
                    )}
                    <Box component="span" sx={{ flex: 1 }}>{n.name}</Box>
                    {hasKids && <Box component="span" sx={{ color: "text.secondary" }}>›</Box>}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, py: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
          <Button size="small" variant="plain" onClick={() => { setDraft([]); onChange(multiple ? [] : ""); close(); }}>
            清空
          </Button>
          {multiple && (
            <Button size="small" variant="filled" onClick={() => { onChange(draft); close(); }}>
              确定
            </Button>
          )}
        </Box>
      </Popover>
    </Box>
  );
}
