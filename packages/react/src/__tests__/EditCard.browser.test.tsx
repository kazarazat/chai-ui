import { render } from "vitest-browser-react";
import { EditCard } from "../EditCard.js";
import { editCardContract, type EditCardProps } from "./contracts/edit-card.contract.js";

editCardContract((props: EditCardProps) => {
  const screen = render(<EditCard {...props} />);
  return { ...screen, rerender: (next: EditCardProps) => screen.rerender(<EditCard {...next} />) };
});
