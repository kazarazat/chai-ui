---
"@chai-ui/react": patch
---

Fix the edit card's region instruction field, which lost its styles in 0.2.0 (it showed as plain text along the bottom of the card instead of floating by its region). A broken stylesheet comment hid the rule; the token lint now fails on unbalanced CSS comments.
