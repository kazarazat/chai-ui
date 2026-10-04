/**
 * Icons shared by more than one component. Each is an inline
 * `currentColor` SVG, the convention every component file follows.
 * The media-action icons are traced from the result card design; the rest
 * are real Material Symbols paths (viewBox `0 -960 960 960`) copied from
 * `@material-symbols/svg-400`.
 */

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M8.99961 11.9999L5.24961 8.2499L6.29961 7.1624L8.24961 9.1124V2.9999H9.74961V9.1124L11.6996 7.1624L12.7496 8.2499L8.99961 11.9999ZM2.99961 14.9999V11.2499H4.49961V13.4999H13.4996V11.2499H14.9996V14.9999H2.99961Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.99961 16.4999V5.9999H6.74961V7.4999H4.49961V14.9999H13.4996V7.4999H11.2496V5.9999H14.9996V16.4999H2.99961ZM8.24961 11.9999V3.61865L7.04961 4.81865L5.99961 3.7499L8.99961 0.749904L11.9996 3.7499L10.9496 4.81865L9.74961 3.61865V11.9999H8.24961Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ExpandIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2 6V2h4M12 2h4v4M16 12v4h-4M6 16H2v-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Material Symbols "zoom_in". */
export function ZoomInIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M796-121 533-384q-30 26-69.96 40.5Q423.08-329 378-329q-108.16 0-183.08-75Q120-479 120-585t75-181q75-75 181.5-75t181 75Q632-691 632-584.85 632-542 618-502q-14 40-42 75l264 262-44 44ZM377-389q81.25 0 138.13-57.5Q572-504 572-585t-56.87-138.5Q458.25-781 377-781q-82.08 0-139.54 57.5Q180-666 180-585t57.46 138.5Q294.92-389 377-389Zm-31-85v-82h-82v-60h82v-81h60v81h81v60h-81v82h-60Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "zoom_out". */
export function ZoomOutIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389ZM275-556v-60h201v60H275Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "add". */
export function AddIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "delete". */
export function DeleteIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-41v-60h188v-30h264v30h188v60h-41v570q0 24-18 42t-42 18H261Zm438-630H261v570h438v-570ZM367-266h60v-399h-60v399Zm166 0h60v-399h-60v399ZM261-750v570-570Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "visibility". */
export function VisibilityIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M600.5-379.5Q650-429 650-500t-49.5-120.5Q551-670 480-670t-120.5 49.5Q310-571 310-500t49.5 120.5Q409-330 480-330t120.5-49.5Zm-200-41Q368-453 368-500t32.5-79.5Q433-612 480-612t79.5 32.5Q592-547 592-500t-32.5 79.5Q527-388 480-388t-79.5-32.5ZM216-283Q98-366 40-500q58-134 176-217t264-83q146 0 264 83t176 217q-58 134-176 217t-264 83q-146 0-264-83Zm264-217Zm222.5 174.5Q804-391 857-500q-53-109-154.5-174.5T480-740q-121 0-222.5 65.5T102-500q54 109 155.5 174.5T480-260q121 0 222.5-65.5Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "visibility_off". */
export function VisibilityOffIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="m629-419-44-44q26-71-27-118t-115-24l-44-44q17-11 38-16t43-5q71 0 120.5 49.5T650-500q0 22-5.5 43.5T629-419Zm129 129-40-40q49-36 85.5-80.5T857-500q-50-111-150-175.5T490-740q-42 0-86 8t-69 19l-46-47q35-16 89.5-28T485-800q143 0 261.5 81.5T920-500q-26 64-67 117t-95 93Zm58 226L648-229q-35 14-79 21.5t-89 7.5q-146 0-265-81.5T40-500q20-52 55.5-101.5T182-696L56-822l42-43 757 757-39 44ZM223-654q-37 27-71.5 71T102-500q51 111 153.5 175.5T488-260q33 0 65-4t48-12l-64-64q-11 5-27 7.5t-30 2.5q-70 0-120-49t-50-121q0-15 2.5-30t7.5-27l-97-97Zm305 142Zm-116 58Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "check". */
export function CheckSymbolIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M378-246 154-470l43-43 181 181 384-384 43 43-427 427Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "close". */
export function CloseSymbolIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z" fill="currentColor" />
    </svg>
  );
}
