import SearchMenu from "../primitives/SearchMenu.svelte";
import { searchMenuContract } from "../../../react/src/__tests__/contracts/search-menu.contract.js";
import { renderWith } from "./render.js";

searchMenuContract(renderWith(SearchMenu));
