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

// Real Material Symbols "stop" glyph, the filled variant specifically
// (`stop-fill`, not the base `stop` — that one traces a hollow square-
// outline shape even filled with `currentColor`, which read as a thin
// frame rather than a real stop icon at 24px; design review caught
// this live). Viewbox `0 -960 960 960` — the submit FAB's in-flight state,
// its own doc comment above where it's rendered.
export function StopIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M240-240v-480h480v480H240Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "arrow_forward": Composer's submit and Media Analyzer's. */
export function ArrowForwardIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M686-450H160v-60h526L438-758l42-42 320 320-320 320-42-42 248-248Z" fill="currentColor" />
    </svg>
  );
}

/** MD3 "check" (traced from Figma): a selected option row, a passed evaluation. Not `CheckSymbolIcon`, the Material Symbols path. */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M7.1625 13.5L2.8875 9.225L3.95625 8.15625L7.1625 11.3625L14.0438 4.48125L15.1125 5.55L7.1625 13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ThumbUpIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M5.25039 15.7502V6.00019L10.5004 0.750193L11.8879 2.13769L10.9129 6.00019H17.2504V9.30019L14.5129 15.7502H5.25039ZM6.75039 14.2502H13.5004L15.7504 9.00019V7.50019H9.00039L10.0129 3.37519L6.75039 6.63769V14.2502ZM1.50039 15.7502V6.00019H5.25039V7.50019H3.00039V14.2502H5.25039V15.7502H1.50039Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ThumbDownIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M2.24961 12C1.84961 12 1.49961 11.85 1.19961 11.55C0.899615 11.25 0.749615 10.9 0.749615 10.5V9C0.749615 8.9125 0.762115 8.81875 0.787115 8.71875C0.812115 8.61875 0.837115 8.525 0.862115 8.4375L3.11211 3.15C3.22461 2.9 3.41211 2.6875 3.67461 2.5125C3.93711 2.3375 4.21211 2.25 4.49961 2.25H12.7496V12L8.24961 16.4625C8.06211 16.65 7.84024 16.7594 7.58399 16.7906C7.32774 16.8219 7.08086 16.775 6.84336 16.65C6.60586 16.525 6.43086 16.35 6.31836 16.125C6.20586 15.9 6.18086 15.6688 6.24336 15.4313L7.08711 12H2.24961ZM11.2496 11.3625V3.75H4.49961L2.24961 9V10.5H8.99961L7.98711 14.625L11.2496 11.3625ZM14.9996 2.25C15.4121 2.25 15.7652 2.39688 16.059 2.69063C16.3527 2.98438 16.4996 3.3375 16.4996 3.75V10.5C16.4996 10.9125 16.3527 11.2656 16.059 11.5594C15.7652 11.8531 15.4121 12 14.9996 12H12.7496V10.5H14.9996V3.75H12.7496V2.25H14.9996Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="1.5 1.5 15 15" fill="none" aria-hidden="true">
      <path
        d="M8.99961 15.0002C7.32461 15.0002 5.90586 14.4189 4.74336 13.2564C3.58086 12.0939 2.99961 10.6752 2.99961 9.00019C2.99961 7.32519 3.58086 5.90644 4.74336 4.74394C5.90586 3.58144 7.32461 3.00019 8.99961 3.00019C9.86211 3.00019 10.6871 3.17832 11.4746 3.53457C12.2621 3.89082 12.9371 4.40019 13.4996 5.06269V3.00019H14.9996V8.25019H9.74961V6.75019H12.8996C12.4996 6.05019 11.9527 5.50019 11.259 5.10019C10.5652 4.70019 9.81211 4.50019 8.99961 4.50019C7.74961 4.50019 6.68711 4.93769 5.81211 5.81269C4.93711 6.68769 4.49961 7.75019 4.49961 9.00019C4.49961 10.2502 4.93711 11.3127 5.81211 12.1877C6.68711 13.0627 7.74961 13.5002 8.99961 13.5002C9.96211 13.5002 10.8309 13.2252 11.6059 12.6752C12.3809 12.1252 12.9246 11.4002 13.2371 10.5002H14.8121C14.4621 11.8252 13.7496 12.9064 12.6746 13.7439C11.5996 14.5814 10.3746 15.0002 8.99961 15.0002Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 8.60253 11.6462" fill="none" aria-hidden="true">
      <path
        d="M1.01206 11.6462C0.733745 11.6462 0.495405 11.5323 0.29704 11.3044C0.0990134 11.0761 0 10.8019 0 10.4816V2.32924H1.01206V10.4816H6.57841V11.6462H1.01206ZM3.03619 9.31697C2.75787 9.31697 2.5197 9.20303 2.32167 8.97515C2.12331 8.74689 2.02413 8.47262 2.02413 8.15235V1.16462C2.02413 0.84435 2.12331 0.570082 2.32167 0.341816C2.5197 0.113939 2.75787 0 3.03619 0H7.59047C7.86879 0 8.10713 0.113939 8.30549 0.341816C8.50352 0.570082 8.60253 0.84435 8.60253 1.16462V8.15235C8.60253 8.47262 8.50352 8.74689 8.30549 8.97515C8.10713 9.20303 7.86879 9.31697 7.59047 9.31697H3.03619ZM3.03619 8.15235H7.59047V1.16462H3.03619V8.15235Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The side panel's default mark: a large and a small four-point star. */
export function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.2 6.3 6.3 2.2-6.3 2.2L12 19l-2.2-6.3-6.3-2.2 6.3-2.2z" fill="currentColor" />
      <path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "edit_square": the side panel's New chat. */
export function NewChatIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h405l-60 60H180v600h600v-348l60-60v408q0 24-18 42t-42 18H180Zm300-360ZM360-360v-170l382-382q9-9 20-13t22-4q11 0 22.32 4.5Q817.63-920 827-911l83 84q8.61 8.96 13.3 19.78 4.7 10.83 4.7 22.02 0 11.2-4.5 22.7T910-742L530-360H360Zm508-425-84-84 84 84ZM420-420h85l253-253-43-42-43-42-252 251v86Zm295-295-43-42 43 42 43 42-43-42Z" fill="currentColor" />
    </svg>
  );
}

/** Material Symbols "description": the page, in the side panel's page context. */
export function PageIcon() {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d="M319-250h322v-60H319v60Zm0-170h322v-60H319v60ZM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Zm331-554v-186H220v680h520v-494H551ZM220-820v186-186 680-680Z" fill="currentColor" />
    </svg>
  );
}
