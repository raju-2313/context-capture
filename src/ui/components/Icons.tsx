/**
 * ContextCapture - Real Vector SVG Icon System
 * Clean, lightweight, professional SVG icons replacing all AI-generated emojis and HTML entities.
 */

interface IconProps {
  size?: number;
  class?: string;
  className?: string;
  style?: any;
  color?: string;
}

export function SettingsIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function SparklesIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      <path d="M19 4v4" />
      <path d="M21 6h-4" />
    </svg>
  );
}

export function ScreenshotIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function BookmarkIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function NoteIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function TextIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

export function CodeIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function QuestionIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function SearchIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function CopyIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function CheckIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function TrashIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function EditIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function ExportIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function ImportIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m8 17 4 4 4-4" />
    </svg>
  );
}

export function FolderIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ProjectIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function LockIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function MicIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function StopIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

export function ZipIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function PdfIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function MarkdownIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2.5 3 2.5-3v6" />
      <path d="M17 13l-2 2-2-2" />
      <path d="M15 9v6" />
    </svg>
  );
}

export function ObsidianIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="6 3 18 3 22 9 12 22 2 9" />
      <polyline points="12 22 12 9 22 9" />
      <polyline points="12 9 2 9" />
    </svg>
  );
}

export function LightbulbIcon({ size = 16, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

export function DuplicateIcon({ size = 14, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function CloseIcon({ size = 14, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ExpandIcon({ size = 14, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export function PlusIcon({ size = 14, class: cls, className, style, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} class={cls || className} style={style} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

