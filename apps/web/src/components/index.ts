/** 公用组件库出口（docs/multiplatform-console-redesign.md 5.3 的第一批）。 */

export { Button, type ButtonProps, type ButtonVariant } from "@/components/controls/Button";
export {
  SegmentedControl, type SegmentedControlProps, type SegmentedOption,
} from "@/components/controls/SegmentedControl";
export { Switch, type SwitchProps } from "@/components/controls/Switch";
export { MultiSelect, type MultiSelectProps, type SelectOption } from "@/components/controls/MultiSelect";
export { Cascader, type CascaderProps, type CascaderNode } from "@/components/controls/Cascader";
export { TextField, type TextFieldProps } from "@/components/controls/TextField";
export { NumberField, type NumberFieldProps } from "@/components/controls/NumberField";
export { Select, type SelectProps } from "@/components/controls/Select";

export { StatusDot, type StatusDotProps, type StatusTone } from "@/components/data/StatusDot";
export { Pill, type PillProps, type PillTone } from "@/components/data/Pill";
export { EmptyState, type EmptyStateProps } from "@/components/data/EmptyState";
export { Skeleton } from "@/components/data/Skeleton";
export { ScoreRing, type ScoreRingProps } from "@/components/data/ScoreRing";
export { DataTable, CellTitle, type Column, type DataTableProps } from "@/components/data/DataTable";
export { SearchFilterBar, type SearchFilterBarProps, type FilterOption } from "@/components/data/SearchFilterBar";
export { JobCard, type JobCardProps } from "@/components/data/JobCard";
export { JobDetailDrawer, type JobDetailDrawerProps } from "@/components/data/JobDetailDrawer";
export { StatTile, type StatTileProps } from "@/components/data/StatTile";
export { ChartCard, type ChartCardProps, type ChartTable } from "@/components/data/ChartCard";
export { BarChart, type BarChartProps, type BarDatum } from "@/components/data/BarChart";
export { ColumnChart, type ColumnChartProps, type ColumnDatum } from "@/components/data/ColumnChart";

export { Surface, type SurfaceProps } from "@/components/surfaces/Surface";
export { InsetGroup, InsetRow, type InsetGroupProps, type InsetRowProps } from "@/components/surfaces/InsetGroup";

export { ToastProvider, useToast, type ToastApi, type ToastTone } from "@/components/feedback/Toast";
export { Sheet, type SheetProps } from "@/components/feedback/Sheet";
export { ConfirmSheet, type ConfirmSheetProps } from "@/components/feedback/ConfirmSheet";
export { InlineAlert, type InlineAlertProps, type InlineAlertTone } from "@/components/feedback/InlineAlert";
export { ProgressBar, type ProgressBarProps } from "@/components/feedback/ProgressBar";
export { EventStream, type EventStreamProps, type TaskEvent, type EventKind } from "@/components/feedback/EventStream";
export { TaskPanel, type TaskPanelProps } from "@/components/feedback/TaskPanel";

export { PageHeader, type PageHeaderProps } from "@/components/layout/PageHeader";
export { ScrollArea, pageRootSx } from "@/components/layout/ScrollArea";
export { TopBar, type TopBarProps } from "@/components/layout/TopBar";
export { PlatformSidebar, type PlatformSidebarProps } from "@/components/layout/PlatformSidebar";
export { TaskBadge, SessionSignal } from "@/components/layout/TaskBadge";
export { PageTransition } from "@/components/layout/PageTransition";
export { ViewFade } from "@/components/layout/ViewFade";
