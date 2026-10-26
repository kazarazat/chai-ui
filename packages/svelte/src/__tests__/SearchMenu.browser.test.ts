import SearchMenu from "../primitives/SearchMenu.svelte";
import { searchMenuContract } from "../../../shared/contracts/search-menu.contract.js";
import { renderWith } from "./render.js";

searchMenuContract(renderWith(SearchMenu));
